"""
Sync Executor - orchestrates the sync process between master and slave databases.
"""

import json
from datetime import datetime
from typing import Any, Dict, List, Optional
import asyncio

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session
from app.models.sync_config import SyncConfig
from app.models.datasource import Datasource
from app.models.job import SyncJob, JobStatus
from app.models.conflict import Conflict
from app.adapters import get_adapter
from app.engine.field_mapper import FieldMapper
from app.engine.conflict_resolver import ConflictResolver, ConflictRequiresManualResolution


async def execute_sync(job_id: str, config_id: str) -> None:
    """
    Execute a sync job from master to slave.
    
    This function runs as a background task and updates the job status
    as it progresses.
    """
    async with async_session() as db:
        # Load job and config
        job_result = await db.execute(
            select(SyncJob).where(SyncJob.id == job_id)
        )
        job = job_result.scalar_one()
        
        config_result = await db.execute(
            select(SyncConfig)
            .options(
                selectinload(SyncConfig.field_mappings),
                selectinload(SyncConfig.master_view),
                selectinload(SyncConfig.slave_view)
            )
            .where(SyncConfig.id == config_id)
        )
        config = config_result.scalar_one()
        
        # Load datasources
        master_result = await db.execute(
            select(Datasource).where(Datasource.id == config.master_datasource_id)
        )
        master_ds = master_result.scalar_one()
        
        slave_result = await db.execute(
            select(Datasource).where(Datasource.id == config.slave_datasource_id)
        )
        slave_ds = slave_result.scalar_one()
        
        # Update job status to running
        job.status = JobStatus.RUNNING
        job.started_at = datetime.utcnow()
        await db.commit()
        
        try:
            # Initialize adapters
            master_adapter = get_adapter(master_ds)
            slave_adapter = get_adapter(slave_ds)
            
            # Initialize mapper and resolver
            mapper = FieldMapper(config.field_mappings)
            resolver = ConflictResolver(config)
            
            async with master_adapter, slave_adapter:
                # Prepare filters from views if available
                master_filters = {}
                if config.master_view:
                    # Simple conversion of JSON filters to 'where' dict for adapters
                    for f in config.master_view.filters:
                        if isinstance(f, dict) and f.get("field") and f.get("value"):
                            master_filters[f["field"]] = f["value"]
                
                # Get total record count (applying filters)
                job.total_records = await master_adapter.count_records(config.master_table, where=master_filters)
                await db.commit()
                
                # Process in batches
                offset = 0
                while True:
                    # Read batch from master
                    master_records = await master_adapter.read_records(
                        table=config.master_table,
                        columns=mapper.get_master_columns(),
                        limit=config.batch_size,
                        offset=offset,
                        where=master_filters,
                    )
                    
                    if not master_records:
                        break
                    
                    # Process each record
                    for master_record in master_records:
                        try:
                            await _sync_record(
                                db=db,
                                job=job,
                                config=config,
                                master_adapter=master_adapter,
                                slave_adapter=slave_adapter,
                                mapper=mapper,
                                resolver=resolver,
                                master_record=master_record,
                            )
                        except Exception as e:
                            job.error_count += 1
                            # Log but continue
                        
                        job.processed_records += 1
                    
                    # Commit progress
                    await db.commit()
                    offset += config.batch_size
            
            # Handle deletions if enabled
            if config.sync_deletes:
                await _sync_deletions(
                    db=db,
                    job=job,
                    config=config,
                    master_adapter=master_adapter,
                    slave_adapter=slave_adapter,
                    mapper=mapper,
                )
            
            # Mark job complete
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.utcnow()
            
            # Update config last sync time
            config.last_sync_at = datetime.utcnow()
            
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.utcnow()
        
        await db.commit()


async def _sync_record(
    db,
    job: SyncJob,
    config: SyncConfig,
    master_adapter,
    slave_adapter,
    mapper: FieldMapper,
    resolver: ConflictResolver,
    master_record: Dict[str, Any],
) -> None:
    """Sync a single record from master to slave."""
    
    # Get key value
    key_mapping = mapper.get_key_mapping()
    if not key_mapping:
        # Use config's pk column
        master_key = master_record.get(config.master_pk_column)
    else:
        master_key = master_record.get(key_mapping.master_column)
    
    # Check if record exists in slave
    slave_key_col = key_mapping.slave_column if key_mapping else config.slave_pk_column
    existing_slave = await slave_adapter.read_record_by_key(
        table=config.slave_table,
        key_column=slave_key_col,
        key_value=master_key,
    )
    
    if existing_slave:
        # Check for conflicts
        conflicting_fields = mapper.find_conflicts(master_record, existing_slave)
        
        if conflicting_fields:
            try:
                # Try to resolve conflict
                resolved = await resolver.resolve(
                    record_key=str(master_key),
                    master_data=master_record,
                    slave_data=existing_slave,
                    conflicting_fields=conflicting_fields,
                )
                
                # Transform and upsert resolved data
                slave_record = mapper.master_to_slave(resolved)
                await slave_adapter.upsert_record(
                    table=config.slave_table,
                    record=slave_record,
                    key_column=slave_key_col,
                )
                job.updated_records += 1
                
            except ConflictRequiresManualResolution as e:
                # Create conflict record
                conflict = resolver.create_conflict_record(
                    job_id=job.id,
                    record_key=str(master_key),
                    master_data=master_record,
                    slave_data=existing_slave,
                    conflicting_fields=conflicting_fields,
                )
                db.add(conflict)
                job.conflict_count += 1
        else:
            # No conflict, update with master data
            slave_record = mapper.master_to_slave(master_record)
            await slave_adapter.upsert_record(
                table=config.slave_table,
                record=slave_record,
                key_column=slave_key_col,
            )
            job.updated_records += 1
    else:
        # New record, insert
        slave_record = mapper.master_to_slave(master_record)
        await slave_adapter.upsert_record(
            table=config.slave_table,
            record=slave_record,
            key_column=slave_key_col,
        )
        job.inserted_records += 1


async def _sync_deletions(
    db,
    job: SyncJob,
    config: SyncConfig,
    master_adapter,
    slave_adapter,
    mapper: FieldMapper,
) -> None:
    """Sync deletions: remove slave records that don't exist in master."""
    
    key_mapping = mapper.get_key_mapping()
    master_pk = config.master_pk_column
    slave_pk = key_mapping.slave_column if key_mapping else config.slave_pk_column
    
    # Get all keys from master
    master_records = await master_adapter.read_records(
        table=config.master_table,
        columns=[master_pk],
        limit=100000,  # Adjust based on expected size
    )
    master_keys = {r[master_pk] for r in master_records}
    
    # Get all keys from slave
    slave_records = await slave_adapter.read_records(
        table=config.slave_table,
        columns=[slave_pk],
        limit=100000,
    )
    
    # Delete records that exist in slave but not in master
    for slave_record in slave_records:
        slave_key = slave_record[slave_pk]
        if slave_key not in master_keys:
            deleted = await slave_adapter.delete_record(
                table=config.slave_table,
                key_column=slave_pk,
                key_value=slave_key,
            )
            if deleted:
                job.deleted_records += 1
