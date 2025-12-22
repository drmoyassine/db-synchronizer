"""
Datasources API router - CRUD operations for database connections.
"""

import logging
import json
from datetime import datetime, timezone
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.datasource import Datasource
from app.schemas.datasource import (
    DatasourceCreate,
    DatasourceUpdate,
    DatasourceResponse,
    DatasourceTestResult,
    DatasourceTestRequest,
    TableSchema,
)
from app.adapters import get_adapter


from sqlalchemy.orm import selectinload

router = APIRouter()
logger = logging.getLogger("app.routers.datasources")


@router.post("", response_model=DatasourceResponse, status_code=status.HTTP_201_CREATED)
async def create_datasource(
    data: DatasourceCreate,
    db: AsyncSession = Depends(get_db)
):
    """Register a new datasource."""
    # Check for duplicate name
    existing_result = await db.execute(
        select(Datasource).where(Datasource.name == data.name)
    )
    if existing_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Datasource with name '{data.name}' already exists"
        )

    # TODO: Encrypt password and api_key before storing
    datasource = Datasource(
        name=data.name,
        type=data.type,
        host=data.host,
        port=data.port,
        database=data.database,
        username=data.username,
        password_encrypted=data.password,  # TODO: encrypt
        api_url=data.api_url,
        api_key_encrypted=data.api_key,  # TODO: encrypt
        table_prefix=data.table_prefix,
        extra_config=json.dumps(data.extra_config) if data.extra_config else None,
    )
    
    db.add(datasource)
    await db.commit()
    
    # Re-fetch with relationships to avoid 500 in serialization
    result = await db.execute(
        select(Datasource)
        .options(selectinload(Datasource.views))
        .where(Datasource.id == datasource.id)
    )
    datasource = result.scalar_one()
    
    return datasource


@router.get("", response_model=List[DatasourceResponse])
async def list_datasources(
    db: AsyncSession = Depends(get_db)
):
    """List all registered datasources."""
    from app.models.view import DatasourceView
    
    # Fetch datasources
    result = await db.execute(
        select(Datasource)
        .order_by(Datasource.created_at.desc())
    )
    datasources = result.scalars().all()
    
    # Manually fetch views for all datasources
    ds_ids = [ds.id for ds in datasources]
    views_by_ds = {}
    if ds_ids:
        views_result = await db.execute(
            select(DatasourceView).where(DatasourceView.datasource_id.in_(ds_ids))
        )
        all_views = views_result.scalars().all()
        
        # Group views by datasource_id
        for v in all_views:
            if v.datasource_id not in views_by_ds:
                views_by_ds[v.datasource_id] = []
            views_by_ds[v.datasource_id].append(v)
    
    logger.info(f"DEBUG: Found {len(views_by_ds)} datasources with views. Keys: {list(views_by_ds.keys())}")
    for ds_id, views in views_by_ds.items():
        logger.info(f"DEBUG: DS {ds_id} has {len(views)} views")
    
    # Build response manually to avoid lazy loading issues
    response = []
    for ds in datasources:
        # Convert views to dict format
        ds_views = []
        for v in views_by_ds.get(ds.id, []):
            ds_views.append({
                "id": v.id,
                "name": v.name,
                "description": v.description,
                "target_table": v.target_table,
                "filters": v.filters,
                "datasource_id": v.datasource_id,
                "created_at": v.created_at,
                "updated_at": v.updated_at
            })
        
        ds_dict = {
            "id": ds.id,
            "name": ds.name,
            "type": ds.type,
            "host": ds.host,
            "port": ds.port,
            "database": ds.database,
            "username": ds.username,
            "api_url": ds.api_url,
            "table_prefix": ds.table_prefix,
            "is_active": ds.is_active,
            "last_tested_at": ds.last_tested_at,
            "last_test_success": ds.last_test_success,
            "created_at": ds.created_at,
            "updated_at": ds.updated_at,
            "extra_config": ds.extra_config,
            "views": ds_views
        }
        response.append(ds_dict)
    
    return response


@router.get("/{datasource_id}", response_model=DatasourceResponse)
async def get_datasource(
    datasource_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific datasource by ID."""
    result = await db.execute(
        select(Datasource)
        .options(selectinload(Datasource.views))
        .where(Datasource.id == datasource_id)
    )
    datasource = result.scalar_one_or_none()
    
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Datasource not found"
        )
    
    return datasource


@router.put("/{datasource_id}", response_model=DatasourceResponse)
async def update_datasource(
    datasource_id: str,
    data: DatasourceUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a datasource."""
    result = await db.execute(
        select(Datasource).where(Datasource.id == datasource_id)
    )
    datasource = result.scalar_one_or_none()
    
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Datasource not found"
        )
    
    # Update fields if provided
    update_data = data.model_dump(exclude_unset=True)
    sensitive_fields = ["host", "port", "database", "username", "password", "connection_uri", "api_url", "api_key"]
    should_reset_test = any(field in update_data for field in sensitive_fields)
    
    for field, value in update_data.items():
        if field == "password" and value:
            setattr(datasource, "password_encrypted", value)  # TODO: encrypt
        elif field == "api_key" and value:
            setattr(datasource, "api_key_encrypted", value)  # TODO: encrypt
        elif hasattr(datasource, field):
            setattr(datasource, field, value)
            
    if should_reset_test:
        datasource.last_test_success = None
        datasource.last_tested_at = None
    
    await db.commit()
    await db.refresh(datasource)
    
    return datasource


@router.delete("/{datasource_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_datasource(
    datasource_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a datasource."""
    result = await db.execute(
        select(Datasource).where(Datasource.id == datasource_id)
    )
    datasource = result.scalar_one_or_none()
    
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Datasource not found"
        )
    
    await db.delete(datasource)
    await db.commit()


@router.post("/{datasource_id}/test", response_model=DatasourceTestResult)
async def test_datasource(
    datasource_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Test a datasource connection."""
    logger.info(f"Testing connection for saved datasource: {datasource_id}")
    result = await db.execute(
        select(Datasource).where(Datasource.id == datasource_id)
    )
    datasource = result.scalar_one_or_none()
    
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Datasource not found"
        )
    
    try:
        # Get appropriate adapter and test connection
        adapter = get_adapter(datasource)
        await adapter.connect()
        tables = await adapter.get_tables()
        await adapter.disconnect()
        
        # Update test status
        datasource.last_tested_at = datetime.now(timezone.utc)
        datasource.last_test_success = True
        await db.commit()
        
        return DatasourceTestResult(
            success=True,
            message="Connection successful",
            tables=tables
        )
    except Exception as e:
        logger.error(f"Error testing datasource {datasource_id}: {str(e)}", exc_info=True)
        # Update test status
        datasource.last_tested_at = datetime.now(timezone.utc)
        datasource.last_test_success = False
        await db.commit()
        
        return DatasourceTestResult(
            success=False,
            message="Connection failed",
            error=str(e),
            suggestion=_get_error_suggestion(e)
        )
@router.post("/test-raw", response_model=DatasourceTestResult)
async def test_new_datasource(
    data: DatasourceTestRequest,
):
    """Test a new datasource connection with raw credentials without saving."""
    logger.info(f"Testing raw connection for new datasource: {data.name or 'Unnamed'} (Type: {data.type})")
    try:
        # Create a transient datasource object
        datasource = Datasource(
            name=data.name,
            type=data.type,
            host=data.host,
            port=data.port,
            database=data.database,
            username=data.username,
            password_encrypted=data.password,
            api_url=data.api_url,
            api_key_encrypted=data.api_key,
            table_prefix=data.table_prefix,
            extra_config=str(data.extra_config) if data.extra_config else None,
        )
        
        # Get appropriate adapter and test connection
        adapter = get_adapter(datasource)
        await adapter.connect()
        tables = await adapter.get_tables()
        await adapter.disconnect()
        
        return DatasourceTestResult(
            success=True,
            message="Connection successful",
            tables=tables
        )
    except Exception as e:
        logger.error(f"Error testing raw datasource {data.name}: {str(e)}", exc_info=True)
        return DatasourceTestResult(
            success=False,
            message="Connection failed",
            error=str(e),
            suggestion=_get_error_suggestion(e)
        )


@router.post("/{datasource_id}/test-update", response_model=DatasourceTestResult)
async def test_datasource_update(
    datasource_id: str,
    data: DatasourceUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Test a datasource connection with proposed updates merged into existing config."""
    logger.info(f"Testing connection update for datasource: {datasource_id}")
    result = await db.execute(
        select(Datasource).where(Datasource.id == datasource_id)
    )
    datasource = result.scalar_one_or_none()
    
    if not datasource:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Datasource not found"
        )
    
    # Create a copy of the datasource to test without saving changes to DB
    # We use the existing values and override with provided update data
    test_ds = Datasource(
        name=data.name or datasource.name,
        type=datasource.type, # Type shouldn't change
        host=data.host or datasource.host,
        port=data.port or datasource.port,
        database=data.database or datasource.database,
        username=data.username or datasource.username,
        password_encrypted=data.password or datasource.password_encrypted,
        api_url=data.api_url or datasource.api_url,
        api_key_encrypted=data.api_key or datasource.api_key_encrypted,
        table_prefix=data.table_prefix or datasource.table_prefix,
    )
    
    try:
        adapter = get_adapter(test_ds)
        await adapter.connect()
        tables = await adapter.get_tables()
        await adapter.disconnect()
        
        return DatasourceTestResult(
            success=True,
            message="Connection successful (updates validated)",
            tables=tables
        )
    except Exception as e:
        logger.error(f"Error testing update for datasource {datasource_id}: {str(e)}", exc_info=True)
        return DatasourceTestResult(
            success=False,
            message="Connection failed with these settings",
            error=str(e),
            suggestion=_get_error_suggestion(e)
        )
@router.get("/{datasource_id}/tables", response_model=List[str])
async def get_datasource_tables(
    datasource_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get list of tables/resources from a datasource."""
    result = await db.execute(select(Datasource).where(Datasource.id == datasource_id))
    datasource = result.scalar_one_or_none()
    
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    
    try:
        adapter = get_adapter(datasource)
        async with adapter:
            return await adapter.get_tables()
    except Exception as e:
        logger.error(f"Error fetching tables for {datasource_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch tables: {str(e)}")


@router.get("/{datasource_id}/tables/{table}/schema", response_model=TableSchema)
async def get_table_schema(
    datasource_id: str,
    table: str,
    refresh: bool = False,  # Query param to force refresh
    db: AsyncSession = Depends(get_db)
):
    """
    Get schema for a specific table in a datasource.
    
    Schema is cached in SQLite for instant subsequent loads.
    Use ?refresh=true to force a fresh fetch from the source.
    """
    from app.models.table_schema import TableSchemaCache
    from sqlalchemy import delete
    
    result = await db.execute(select(Datasource).where(Datasource.id == datasource_id))
    datasource = result.scalar_one_or_none()
    
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    
    # Check for cached schema (unless refresh requested)
    if not refresh:
        cache_result = await db.execute(
            select(TableSchemaCache).where(
                TableSchemaCache.datasource_id == datasource_id,
                TableSchemaCache.table_name == table
            )
        )
        cached = cache_result.scalar_one_or_none()
        if cached:
            logger.debug(f"Schema cache hit for {datasource_id}/{table}")
            return TableSchema(columns=cached.columns)
    
    # No cache or refresh requested - fetch from source
    try:
        adapter = get_adapter(datasource)
        async with adapter:
            schema = await adapter.get_schema(table)
        
        # Store in cache (upsert)
        if refresh:
            # Delete old cache entry if exists
            await db.execute(
                delete(TableSchemaCache).where(
                    TableSchemaCache.datasource_id == datasource_id,
                    TableSchemaCache.table_name == table
                )
            )
        
        new_cache = TableSchemaCache(
            datasource_id=datasource_id,
            table_name=table,
            columns=schema["columns"]
        )
        db.add(new_cache)
        await db.commit()
        
        logger.info(f"Schema fetched and cached for {datasource_id}/{table}")
        return TableSchema(**schema)
    except Exception as e:
        logger.error(f"Error fetching schema for {datasource_id} table {table}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch schema: {str(e)}")

@router.get("/{datasource_id}/tables/{table}/data")
async def get_datasource_table_data(
    datasource_id: str,
    table: str,
    limit: int = 10,
    filters: Optional[str] = None,  # JSON string of filters
    db: AsyncSession = Depends(get_db)
):
    """Get sample data for a specific table in a datasource."""
    result = await db.execute(select(Datasource).where(Datasource.id == datasource_id))
    datasource = result.scalar_one_or_none()
    
    if not datasource:
        raise HTTPException(status_code=404, detail="Datasource not found")
    
    # Parse filters if provided
    where = None
    if filters:
        try:
            where = json.loads(filters)
            # Ensure it's a list of dicts
            if not isinstance(where, list):
                where = None
        except Exception:
            where = None

    try:
        adapter = get_adapter(datasource)
        async with adapter:
            records = await adapter.read_records(table, limit=limit, where=where)
            total = await adapter.count_records(table, where=where)
            # Ensure total is never less than actual records returned
            total = max(total, len(records))
            return {
                "records": records,
                "total": total
            }
    except Exception as e:
        logger.error(f"Error fetching data for {datasource_id} table {table}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch sample data: {str(e)}")


def _get_error_suggestion(e: Exception) -> Optional[str]:
    """Helper to provide diagnostic suggestions for common connection errors."""
    msg = str(e).lower()
    if "2003" in msg or "can't connect to mysql server" in msg:
        return "This usually means the MySQL port (typically 3306) is blocked or the host is incorrect. Ensure Remote MySQL access is enabled in your hosting panel and your IP is whitelisted."
    if "getaddrinfo failed" in msg:
        return "The hostname could not be resolved. Ensure you aren't including 'http://' in the host field and check for typos."
    if "access denied" in msg or "password" in msg:
        return "Authentication failed. Verify your username and password are correct for remote access."
    if "timeout" in msg:
        return "The connection timed out. Check your firewall settings and ensure the server is listening on the correct port."
    return None
