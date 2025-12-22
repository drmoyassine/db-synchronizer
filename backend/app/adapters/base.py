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
        """Get schema information for a table."""
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
        """Read records from a table."""
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
        """Insert or update a record."""
        pass
    
    @abstractmethod
    async def delete_record(
        self,
        table: str,
        key_column: str,
        key_value: Any,
    ) -> bool:
        """Delete a record by key."""
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


class SQLAdapter(DatabaseAdapter, ABC):
    """
    Base class for SQL-based adapters (Postgres, MySQL, etc.).
    Provides shared logic for query building and connection management.
    """
    
    def _sanitize_host(self, host: str) -> str:
        """Removes protocol and path if a URL was provided as a host."""
        if not host:
            return host
        if "://" in host:
            host = host.split("://")[-1]
        if "/" in host:
            host = host.split("/")[0]
        return host

    def _build_where_clause(
        self, 
        where: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]],
        placeholder: str = "%s",
        use_index: bool = False
    ) -> tuple[str, List[Any]]:
        """
        Generic SQL WHERE clause builder.
        
        Args:
            where: Filter conditions
            placeholder: The placeholder style (%s for MySQL/SQLite, $1 for Postgres)
            use_index: If True, uses $1, $2 instead of $ placeholder.
        """
        if not where:
            return "", []
            
        conditions = []
        params = []
        
        # Normalize to list of dicts
        filter_list = where if isinstance(where, list) else [{"field": k, "operator": "==", "value": v} for k, v in where.items()]
        
        for f in filter_list:
            k = f.get("field")
            v = f.get("value")
            op = f.get("operator", "==")
            
            if not k or v is None:
                continue
            
            p_idx = len(params) + 1
            curr_placeholder = f"${p_idx}" if use_index else placeholder
            
            if op == "==":
                conditions.append(f'"{k}" = {curr_placeholder}')
                params.append(v)
            elif op == "!=":
                conditions.append(f'"{k}" != {curr_placeholder}')
                params.append(v)
            elif op == ">":
                conditions.append(f'"{k}" > {curr_placeholder}')
                params.append(v)
            elif op == "<":
                conditions.append(f'"{k}" < {curr_placeholder}')
                params.append(v)
            elif op == "contains":
                # Note: this might need db-specific casting in some cases (like Postgres ::text)
                conditions.append(f'"{k}" LIKE {curr_placeholder}')
                params.append(f"%{v}%")
        
        if not conditions:
            return "", []
            
        return " WHERE " + " AND ".join(conditions), params
