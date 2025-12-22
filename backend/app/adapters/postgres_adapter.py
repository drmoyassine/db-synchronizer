"""
PostgreSQL adapter using asyncpg for direct Postgres connections.
"""

from typing import Any, Dict, List, Optional, Union
import logging
import asyncpg

from app.adapters.base import DatabaseAdapter
from app.models.datasource import Datasource


class PostgresAdapter(DatabaseAdapter):
    """PostgreSQL database adapter using asyncpg."""
    
    def __init__(self, datasource: "Datasource"):
        super().__init__(datasource)
        self._pool: Optional[asyncpg.Pool] = None
        self.logger = logging.getLogger(f"app.adapters.postgres.{self.datasource.name}")
    
    async def connect(self) -> None:
        """Establish connection pool to PostgreSQL."""
        host = self.datasource.host
        port = self.datasource.port
        db_name = self.datasource.database
        user = self.datasource.username
        
        self.logger.info(f"Connecting to Postgres: host='{host}', port={port}, database='{db_name}', user='{user}'")
        
        if not host:
            self.logger.error("Connection failed: Host is empty")
            raise ValueError("Database host is required")
            
        if "://" in host or host.startswith(("http://", "https://")):
            self.logger.warning(f"Host '{host}' appears to be a URL, not a hostname. This may cause getaddrinfo to fail.")
            # Simple sanitization - remove protocol if present
            if "://" in host:
                host = host.split("://")[-1].split("/")[0]
                self.logger.info(f"Sanitized host to: '{host}'")

        try:
            self._pool = await asyncpg.create_pool(
                host=host,
                port=port,
                database=db_name,
                user=user,
                password=self.datasource.password_encrypted,  # TODO: decrypt
                min_size=1,
                max_size=10,
            )
            self.logger.info("Successfully established connection pool")
        except Exception as e:
            self.logger.error(f"Failed to connect to Postgres: {str(e)}")
            raise
    
    async def disconnect(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
    
    async def get_tables(self) -> List[str]:
        """Get list of tables in public schema."""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            """)
            return [row["table_name"] for row in rows]
    
    async def get_schema(self, table: str) -> Dict[str, Any]:
        """Get column information for a table."""
        async with self._pool.acquire() as conn:
            rows = await conn.fetch("""
                SELECT 
                    c.column_name,
                    c.data_type,
                    c.is_nullable,
                    c.column_default,
                    CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END as is_primary_key
                FROM information_schema.columns c
                LEFT JOIN (
                    SELECT ku.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage ku
                        ON tc.constraint_name = ku.constraint_name
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                    AND tc.table_name = $1
                ) pk ON c.column_name = pk.column_name
                WHERE c.table_name = $1 AND c.table_schema = 'public'
                ORDER BY c.ordinal_position
            """, table)
            
            return {
                "columns": [
                    {
                        "name": row["column_name"],
                        "type": row["data_type"],
                        "nullable": row["is_nullable"] == "YES",
                        "default": row["column_default"],
                        "primary_key": row["is_primary_key"],
                    }
                    for row in rows
                ]
            }
    
    def _build_where_clause(self, where: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]]) -> tuple[str, List[Any]]:
        """Helper to build WHERE clause from structured filters."""
        if not where:
            return "", []
            
        conditions = []
        params = []
        
        filter_list = where if isinstance(where, list) else [{"field": k, "operator": "==", "value": v} for k, v in where.items()]
        
        for f in filter_list:
            k = f.get("field")
            v = f.get("value")
            op = f.get("operator", "==")
            
            if not k or v is None:
                continue
            
            p_idx = len(params) + 1
            if op == "==":
                conditions.append(f'"{k}" = ${p_idx}')
                params.append(v)
            elif op == "!=":
                conditions.append(f'"{k}" != ${p_idx}')
                params.append(v)
            elif op == ">":
                conditions.append(f'"{k}" > ${p_idx}')
                params.append(v)
            elif op == "<":
                conditions.append(f'"{k}" < ${p_idx}')
                params.append(v)
            elif op == "contains":
                conditions.append(f'"{k}"::text ILIKE ${p_idx}')
                params.append(f"%{v}%")
        
        if not conditions:
            return "", []
            
        return " WHERE " + " AND ".join(conditions), params

    async def read_records(
        self,
        table: str,
        columns: Optional[List[str]] = None,
        where: Optional[Union[Dict[str, Any], List[Dict[str, Any]]]] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Read records from table."""
        cols = ", ".join(f'"{c}"' for c in columns) if columns else "*"
        query = f'SELECT {cols} FROM "{table}"'
        params = []
        
        where_clause, params = self._build_where_clause(where)
        query += where_clause
        
        query += f" LIMIT {limit} OFFSET {offset}"
        
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
            return [dict(row) for row in rows]
    
    async def read_record_by_key(
        self,
        table: str,
        key_column: str,
        key_value: Any,
    ) -> Optional[Dict[str, Any]]:
        """Read a single record by primary key."""
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                f'SELECT * FROM "{table}" WHERE "{key_column}" = $1',
                key_value
            )
            return dict(row) if row else None
    
    async def upsert_record(
        self,
        table: str,
        record: Dict[str, Any],
        key_column: str,
    ) -> Dict[str, Any]:
        """Insert or update a record using ON CONFLICT."""
        columns = list(record.keys())
        values = list(record.values())
        
        placeholders = ", ".join(f"${i}" for i in range(1, len(values) + 1))
        col_list = ", ".join(columns)
        
        # Build update clause for non-key columns
        update_cols = [c for c in columns if c != key_column]
        update_clause = ", ".join(f'"{c}" = EXCLUDED."{c}"' for c in update_cols)
        col_list = ", ".join(f'"{c}"' for c in columns)
        
        query = f"""
            INSERT INTO "{table}" ({col_list})
            VALUES ({placeholders})
            ON CONFLICT ("{key_column}") DO UPDATE SET {update_clause}
            RETURNING *
        """
        
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(query, *values)
            return dict(row)
    
    async def delete_record(
        self,
        table: str,
        key_column: str,
        key_value: Any,
    ) -> bool:
        """Delete a record by key."""
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                f'DELETE FROM "{table}" WHERE "{key_column}" = $1',
                key_value
            )
            return result.split()[-1] != "0"
    
    async def count_records(
        self,
        table: str,
        where: Optional[Dict[str, Any]] = None,
    ) -> int:
        """Count records in table."""
        query = f'SELECT COUNT(*) FROM "{table}"'
        params = []
        
        where_clause, params = self._build_where_clause(where)
        query += where_clause
        
        async with self._pool.acquire() as conn:
            return await conn.fetchval(query, *params)
