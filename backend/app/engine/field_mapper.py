"""
Field Mapper - transforms data between master and slave schemas.
"""

from typing import Any, Dict, List, Optional
import json
import re

from app.models.sync_config import FieldMapping


class FieldMapper:
    """
    Maps and transforms fields between master and slave schemas.
    
    Supports:
    - Simple column renaming
    - Type coercion
    - Custom transforms via expressions
    """
    
    def __init__(self, mappings: List[FieldMapping]):
        """Initialize with field mappings."""
        self.mappings = mappings
        self._master_to_slave = {m.master_column: m for m in mappings if not m.skip_sync}
        self._slave_to_master = {m.slave_column: m for m in mappings if not m.skip_sync}
    
    def master_to_slave(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a master record to slave format.
        
        Args:
            record: Master record with master column names
            
        Returns:
            Transformed record with slave column names
        """
        result = {}
        
        for mapping in self.mappings:
            if mapping.skip_sync:
                continue
            
            value = record.get(mapping.master_column)
            
            # Apply transform if specified (pass full record for templating)
            if mapping.transform:
                value = self._apply_transform(value, mapping.transform, record)
            
            result[mapping.slave_column] = value
        
        return result
    
    def slave_to_master(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform a slave record to master format.
        
        Args:
            record: Slave record with slave column names
            
        Returns:
            Transformed record with master column names
        """
        result = {}
        
        for mapping in self.mappings:
            if mapping.skip_sync:
                continue
            
            if mapping.slave_column in record:
                value = record[mapping.slave_column]
                # Note: transforms are one-way (master->slave)
                result[mapping.master_column] = value
        
        return result
    
    def get_key_mapping(self) -> Optional[FieldMapping]:
        """Get the key field mapping."""
        for mapping in self.mappings:
            if mapping.is_key_field:
                return mapping
        return None
    
    def get_master_columns(self) -> List[str]:
        """Get list of master columns to sync."""
        return [m.master_column for m in self.mappings if not m.skip_sync]
    
    def get_slave_columns(self) -> List[str]:
        """Get list of slave columns to sync."""
        return [m.slave_column for m in self.mappings if not m.skip_sync]
    
    def _apply_transform(self, value: Any, transform: str, record: Optional[Dict[str, Any]] = None) -> Any:
        """
        Apply a transform expression to a value.
        
        Supported transforms:
        - "upper" - uppercase string
        - "lower" - lowercase string
        - "trim" - strip whitespace
        - "json" - parse JSON string
        - "str" - convert to string
        - "int" - convert to integer
        - "float" - convert to float
        - "bool" - convert to boolean
        - "default:X" - use X if value is None
        - "prefix:X" - add prefix
        - "suffix:X" - add suffix
        - "replace:old:new" - string replacement
        - "template:JSON_OR_STRING" - interpolate @fields (e.g. {"rendered":"@title"})
        """
        if transform.startswith("template:") and record:
            template = transform[9:]
            # Replace @column_name or {{column_name}}
            # Placeholder for @value is current value
            interpolated = template
            
            # Simple regex replacement for placeholders
            # Matches @[\w_]+ or {{[\w_]+}}
            def replacer(match):
                tag = match.group(0)
                field = tag.replace("@", "").replace("{{", "").replace("}}", "")
                if field == "value":
                    return str(value) if value is not None else ""
                return str(record.get(field, ""))
                
            interpolated = re.sub(r"@[\w_]+|\{\{[\w_]+\}\}", replacer, interpolated)
            
            # Try to parse as JSON if it looks like JSON
            if (interpolated.startswith("{") and interpolated.endswith("}")) or \
               (interpolated.startswith("[") and interpolated.endswith("]")):
                try:
                    return json.loads(interpolated)
                except:
                    pass
            return interpolated

        if value is None:
            # Check for default transform
            if transform.startswith("default:"):
                return transform[8:]
            return None
        
        transform = transform.strip().lower()
        
        if transform == "upper":
            return str(value).upper()
        elif transform == "lower":
            return str(value).lower()
        elif transform == "trim":
            return str(value).strip()
        elif transform == "json":
            return json.loads(value) if isinstance(value, str) else value
        elif transform == "str":
            return str(value)
        elif transform == "int":
            return int(value) if value else 0
        elif transform == "float":
            return float(value) if value else 0.0
        elif transform == "bool":
            if isinstance(value, bool):
                return value
            return str(value).lower() in ("true", "1", "yes")
        elif transform.startswith("prefix:"):
            prefix = transform[7:]
            return f"{prefix}{value}"
        elif transform.startswith("suffix:"):
            suffix = transform[7:]
            return f"{value}{suffix}"
        elif transform.startswith("replace:"):
            parts = transform[8:].split(":", 1)
            if len(parts) == 2:
                return str(value).replace(parts[0], parts[1])
        
        # Unknown transform, return as-is
        return value
    
    def find_conflicts(
        self,
        master_record: Dict[str, Any],
        slave_record: Dict[str, Any],
    ) -> List[str]:
        """
        Find fields that have different values between master and slave.
        
        Returns list of conflicting master column names.
        """
        conflicts = []
        
        for mapping in self.mappings:
            if mapping.skip_sync or mapping.is_key_field:
                continue
            
            master_val = master_record.get(mapping.master_column)
            slave_val = slave_record.get(mapping.slave_column)
            
            # Apply transform for comparison
            if mapping.transform:
                master_val = self._apply_transform(master_val, mapping.transform, master_record)
            
            # Compare values (handle None vs empty string)
            if not self._values_equal(master_val, slave_val):
                conflicts.append(mapping.master_column)
        
        return conflicts
    
    def _values_equal(self, a: Any, b: Any) -> bool:
        """Compare two values for equality, handling edge cases."""
        # Handle None vs empty
        if a is None and b == "":
            return True
        if b is None and a == "":
            return True
        if a is None and b is None:
            return True
        
        # Handle numeric comparison
        if isinstance(a, (int, float)) and isinstance(b, (int, float)):
            return float(a) == float(b)
        
        # String comparison
        return str(a) == str(b)
