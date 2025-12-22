"""
Base database adapter - abstract interface for all database connections.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Union
from app.models.datasource import Datasource


class DatabaseAdapter(ABC):
    """Abstract base class for database adapters."""
    
    def __init__(self, datasource: "Datasource"):
        """Initialize adapter with datasource configuration."""
        self.datasource = datasource
        self._connection = None
    
    @abstractmethod
    async def connect(self) -> None:
        """Establish connection to the database."""
        pass
    
    @abstractmethod
    async def disconnect(self) -> None:
        """Close the database connection."""
        pass
    
    @abstractmethod
    async def get_tables(self) -> List[str]:
        """Get list of available tables."""
        pass
    
    @abstractmethod
    async def get_schema(self, table: str) -> Dict[str, Any]:
        """
        Get schema information for a table.
        
        Returns dict with columns info:
        {
            "columns": [
                {"name": "id", "type": "integer", "nullable": False, "primary_key": True},
                {"name": "title", "type": "text", "nullable": True, "primary_key": False},
            ]
        }
        """
        pass
    
    @abstractmethod
    async def read_records(
        self,
        table: str,
        columns: Optional[List[str]] = None,
        where: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """
        Read records from a table.
        
        Args:
            table: Table name
            columns: List of columns to fetch (None = all)
            where: Filter conditions as dict
            limit: Max records to return
            offset: Records to skip
        
        Returns:
            List of record dicts
        """
        pass
    
    @abstractmethod
    async def read_record_by_key(
        self,
        table: str,
        key_column: str,
        key_value: Any,
    ) -> Optional[Dict[str, Any]]:
        """Read a single record by its primary key."""
        pass
    
    @abstractmethod
    async def upsert_record(
        self,
        table: str,
        record: Dict[str, Any],
        key_column: str,
    ) -> Dict[str, Any]:
        """
        Insert or update a record.
        
        Args:
            table: Table name
            record: Record data
            key_column: Column to use for matching existing records
        
        Returns:
            The upserted record
        """
        pass
    
    @abstractmethod
    async def delete_record(
        self,
        table: str,
        key_column: str,
        key_value: Any,
    ) -> bool:
        """
        Delete a record by key.
        
        Returns:
            True if deleted, False if not found
        """
        pass
    
    @abstractmethod
    async def count_records(
        self,
        table: str,
        where: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None,
    ) -> int:
        """Count records in a table, optionally with filter."""
        pass
    
    async def __aenter__(self):
        """Async context manager entry."""
        await self.connect()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        await self.disconnect()
