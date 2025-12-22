"""
Router for Datasource Views.
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.view import DatasourceView
from app.models.datasource import Datasource
from app.schemas.datasource import DatasourceViewCreate, DatasourceViewUpdate, DatasourceViewResponse
from app.adapters import get_adapter

router = APIRouter()


@router.get("/datasources/{datasource_id}/views", response_model=List[DatasourceViewResponse])
async def list_datasource_views(
    datasource_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List all views for a specific datasource."""
    result = await db.execute(select(DatasourceView).where(DatasourceView.datasource_id == datasource_id))
    return result.scalars().all()


@router.post("/datasources/{datasource_id}/views", response_model=DatasourceViewResponse, status_code=status.HTTP_201_CREATED)
async def create_datasource_view(
    datasource_id: str,
    view: DatasourceViewCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new view for a datasource."""
    # Verify datasource exists
    ds_result = await db.execute(select(Datasource).where(Datasource.id == datasource_id))
    if not ds_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Datasource not found")
        
    db_view = DatasourceView(
        name=view.name,
        description=view.description,
        datasource_id=datasource_id,
        target_table=view.target_table,
        filters=view.filters
    )
    db.add(db_view)
    await db.commit()
    await db.refresh(db_view)
    return db_view


@router.get("/views/{view_id}", response_model=DatasourceViewResponse)
async def get_datasource_view(
    view_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific datasource view."""
    result = await db.execute(select(DatasourceView).where(DatasourceView.id == view_id))
    db_view = result.scalar_one_or_none()
    
    if not db_view:
        raise HTTPException(status_code=404, detail="View not found")
        
    return db_view


@router.patch("/views/{view_id}", response_model=DatasourceViewResponse)
async def update_datasource_view(
    view_id: str,
    view_update: DatasourceViewUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an existing datasource view."""
    result = await db.execute(select(DatasourceView).where(DatasourceView.id == view_id))
    db_view = result.scalar_one_or_none()
    
    if not db_view:
        raise HTTPException(status_code=404, detail="View not found")
        
    # Update fields
    update_data = view_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_view, key, value)
        
    await db.commit()
    await db.refresh(db_view)
    return db_view


@router.get("/views/{view_id}/records")
async def get_view_records(
    view_id: str,
    page: int = 1,
    limit: int = 10,
    db: AsyncSession = Depends(get_db)
):
    """
    Get data matching the view's filters with pagination.
    
    - **page**: Page number (1-indexed, default 1)
    - **limit**: Records per page (default 10)
    
    Returns paginated records with total count and page info.
    """
    if page < 1:
        page = 1
    if limit < 1:
        limit = 10
    if limit > 100:
        limit = 100  # Cap at 100 records per page
    
    offset = (page - 1) * limit
    
    # 1. Get the view definition
    result = await db.execute(select(DatasourceView).where(DatasourceView.id == view_id))
    db_view = result.scalar_one_or_none()
    
    if not db_view:
        raise HTTPException(status_code=404, detail="View not found")
        
    # 2. Get the datasource
    ds_result = await db.execute(select(Datasource).where(Datasource.id == db_view.datasource_id))
    ds = ds_result.scalar_one_or_none()
    
    if not ds:
        raise HTTPException(status_code=404, detail="Associated datasource not found")
        
    # 3. Get adapter and fetch data
    adapter = get_adapter(ds)
    async with adapter:
        records = await adapter.read_records(
            table=db_view.target_table, 
            limit=limit,
            offset=offset,
            where=db_view.filters
        )
        total = await adapter.count_records(
            table=db_view.target_table, 
            where=db_view.filters
        )
        # Ensure total is never less than actual records returned
        total = max(total, len(records) + offset)
    
    # Calculate pagination info
    import math
    from datetime import datetime, timezone
    total_pages = math.ceil(total / limit) if limit > 0 else 1
        
    return {
        "records": records,
        "total_records": total,
        "current_page": page,
        "total_pages": total_pages,
        "per_page": limit,
        "view_name": db_view.name,
        "datasource_name": ds.name,
        "target_table": db_view.target_table,
        "timestamp_utc": datetime.now(timezone.utc).isoformat()
    }


@router.get("/views/{view_id}/count")
async def get_view_count(
    view_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Get the total number of records matching a view's filters.
    
    This is a lightweight endpoint that only returns the count,
    useful for displaying totals without fetching all data.
    """
    # 1. Get the view definition
    result = await db.execute(select(DatasourceView).where(DatasourceView.id == view_id))
    db_view = result.scalar_one_or_none()
    
    if not db_view:
        raise HTTPException(status_code=404, detail="View not found")
        
    # 2. Get the datasource
    ds_result = await db.execute(select(Datasource).where(Datasource.id == db_view.datasource_id))
    ds = ds_result.scalar_one_or_none()
    
    if not ds:
        raise HTTPException(status_code=404, detail="Associated datasource not found")
        
    # 3. Get adapter and count records
    adapter = get_adapter(ds)
    async with adapter:
        total = await adapter.count_records(
            table=db_view.target_table, 
            where=db_view.filters
        )
        
    from datetime import datetime, timezone
    return {
        "view_id": view_id,
        "view_name": db_view.name,
        "total_records": total,
        "target_table": db_view.target_table,
        "datasource_name": ds.name,
        "timestamp_utc": datetime.now(timezone.utc).isoformat()
    }


@router.post("/views/{view_id}/records", status_code=status.HTTP_201_CREATED)
async def create_view_record(
    view_id: str,
    record: Dict[str, Any],
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new record in the table associated with this view.
    """
    result = await db.execute(select(DatasourceView).where(DatasourceView.id == view_id))
    db_view = result.scalar_one_or_none()
    
    if not db_view:
        raise HTTPException(status_code=404, detail="View not found")
        
    ds_result = await db.execute(select(Datasource).where(Datasource.id == db_view.datasource_id))
    ds = ds_result.scalar_one_or_none()
    
    adapter = get_adapter(ds)
    async with adapter:
        # Note: adapters use upsert, but we can call it POST for semantic clarity
        success = await adapter.upsert_record(
            table=db_view.target_table,
            record=record
        )
        
    if not success:
        raise HTTPException(status_code=500, detail="Failed to create record")
        
    return {"success": True, "message": "Record created successfully"}


@router.put("/views/{view_id}/records")
async def update_view_record(
    view_id: str,
    record: Dict[str, Any],
    key_column: str = "id",
    db: AsyncSession = Depends(get_db)
):
    """
    Update an existing record in the table associated with this view.
    """
    result = await db.execute(select(DatasourceView).where(DatasourceView.id == view_id))
    db_view = result.scalar_one_or_none()
    
    if not db_view:
        raise HTTPException(status_code=404, detail="View not found")
        
    ds_result = await db.execute(select(Datasource).where(Datasource.id == db_view.datasource_id))
    ds = ds_result.scalar_one_or_none()
    
    adapter = get_adapter(ds)
    async with adapter:
        success = await adapter.upsert_record(
            table=db_view.target_table,
            record=record,
            key_column=key_column
        )
        
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update record")
        
    return {"success": True, "message": "Record updated successfully"}


@router.delete("/views/{view_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_datasource_view(
    view_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a datasource view."""
    result = await db.execute(select(DatasourceView).where(DatasourceView.id == view_id))
    db_view = result.scalar_one_or_none()
    
    if not db_view:
        raise HTTPException(status_code=404, detail="View not found")
        
    await db.delete(db_view)
    await db.commit()
    return None
