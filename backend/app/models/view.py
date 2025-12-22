"""
DatasourceView model - represents a filtered view of a datasource resource.
"""

from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy import String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
import uuid

from app.database import Base


class DatasourceView(Base):
    """A saved filtered view of a datasource table or resource."""
    
    __tablename__ = "datasource_views"
    
    id: Mapped[str] = mapped_column(
        String(36), 
        primary_key=True, 
        default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    datasource_id: Mapped[str] = mapped_column(
        String(36), 
        ForeignKey("datasources.id"),
        nullable=False
    )
    
    # The actual table or resource name (e.g., 'wp_posts' or 'job_listing')
    target_table: Mapped[str] = mapped_column(String(255), nullable=False)
    
    # The filters stored as JSON
    # Format: [{"field": "post_type", "operator": "==", "value": "institution"}]
    filters: Mapped[Dict[str, Any]] = mapped_column(JSON, default=list)
    
    # Metadata
    created_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        default=lambda: datetime.now(timezone.utc), 
        onupdate=lambda: datetime.now(timezone.utc)
    )
    
    # Relationships
    datasource: Mapped["Datasource"] = relationship("Datasource", back_populates="views")

    def __repr__(self) -> str:
        return f"<DatasourceView {self.name} on {self.target_table}>"
