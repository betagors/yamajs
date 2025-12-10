import { FieldType } from './types.js';

/**
 * Database Type Mapper
 * 
 * Maps YAMA field types to database-specific SQL types.
 * Supports PostgreSQL, MySQL, and SQLite.
 */
export class DatabaseTypeMapper {
  /**
   * Map field type to PostgreSQL type
   */
  static toPostgreSQL(fieldType: FieldType): string {
    // Use override if provided
    if (fieldType.dbType) {
      return fieldType.dbType;
    }
    
    let dbType: string;
    
    switch (fieldType.type) {
      // Strings
      case 'string':
        dbType = `VARCHAR(${fieldType.length || 255})`;
        break;
      case 'text':
        dbType = 'TEXT';
        break;
      case 'email':
      case 'url':
        dbType = `VARCHAR(${fieldType.length || fieldType.maxLength || 255})`;
        break;
      case 'phone':
        dbType = 'VARCHAR(20)';
        break;
      case 'slug':
        dbType = `VARCHAR(${fieldType.length || fieldType.maxLength || 255})`;
        break;
      case 'uuid':
        dbType = 'UUID';
        break;
        
      // Numbers
      case 'int8':
        dbType = 'SMALLINT';
        break;
      case 'int16':
        dbType = 'SMALLINT';
        break;
      case 'int':
      case 'int32':
      case 'uint':
        dbType = 'INTEGER';
        break;
      case 'int64':
      case 'bigint':
        dbType = 'BIGINT';
        break;
      case 'decimal':
        dbType = `DECIMAL(${fieldType.precision || 10}, ${fieldType.scale || 0})`;
        break;
      case 'money':
        dbType = `DECIMAL(${fieldType.precision || 19}, ${fieldType.scale || 4})`;
        break;
      case 'float':
        dbType = 'REAL';
        break;
      case 'double':
        dbType = 'DOUBLE PRECISION';
        break;
        
      // Boolean
      case 'boolean':
        dbType = 'BOOLEAN';
        break;
        
      // Date/Time
      case 'date':
        dbType = 'DATE';
        break;
      case 'time':
        dbType = 'TIME';
        break;
      case 'timestamp':
      case 'timestamptz':
      case 'datetime':
      case 'datetimetz':
        dbType = 'TIMESTAMP WITH TIME ZONE';
        break;
      case 'timestamplocal':
      case 'datetimelocal':
        dbType = 'TIMESTAMP WITHOUT TIME ZONE';
        break;
      case 'interval':
      case 'duration':
        dbType = 'INTERVAL';
        break;
        
      // Complex
      case 'json':
      case 'jsonb':
        dbType = 'JSONB';
        break;
      case 'binary':
        dbType = 'BYTEA';
        break;
      case 'base64':
        dbType = 'TEXT';
        break;
      case 'enum':
        // Custom enum type will be created separately
        dbType = 'VARCHAR(50)'; // Fallback
        break;
        
      default:
        // For custom types or unknown types, default to VARCHAR
        dbType = `VARCHAR(${fieldType.length || 255})`;
    }
    
    // Handle arrays
    if (fieldType.array) {
      dbType += '[]';
    }
    
    return dbType;
  }
  
  /**
   * Map field type to MySQL type
   */
  static toMySQL(fieldType: FieldType): string {
    // Use override if provided
    if (fieldType.dbType) {
      return fieldType.dbType;
    }
    
    let dbType: string;
    
    switch (fieldType.type) {
      // Strings
      case 'string':
        dbType = `VARCHAR(${fieldType.length || 255})`;
        break;
      case 'text':
        dbType = 'TEXT';
        break;
      case 'email':
      case 'url':
        dbType = `VARCHAR(${fieldType.length || fieldType.maxLength || 255})`;
        break;
      case 'phone':
        dbType = 'VARCHAR(20)';
        break;
      case 'slug':
        dbType = `VARCHAR(${fieldType.length || fieldType.maxLength || 255})`;
        break;
      case 'uuid':
        dbType = 'CHAR(36)';
        break;
        
      // Numbers
      case 'int8':
        dbType = 'TINYINT';
        break;
      case 'int16':
        dbType = 'SMALLINT';
        break;
      case 'int':
      case 'int32':
        dbType = 'INT';
        break;
      case 'uint':
        dbType = 'INT UNSIGNED';
        break;
      case 'int64':
      case 'bigint':
        dbType = 'BIGINT';
        break;
      case 'decimal':
        dbType = `DECIMAL(${fieldType.precision || 10}, ${fieldType.scale || 0})`;
        break;
      case 'money':
        dbType = `DECIMAL(${fieldType.precision || 19}, ${fieldType.scale || 4})`;
        break;
      case 'float':
        dbType = 'FLOAT';
        break;
      case 'double':
        dbType = 'DOUBLE';
        break;
        
      // Boolean
      case 'boolean':
        dbType = 'BOOLEAN';
        break;
        
      // Date/Time
      case 'date':
        dbType = 'DATE';
        break;
      case 'time':
        dbType = 'TIME';
        break;
      case 'timestamp':
      case 'timestamptz':
      case 'timestamplocal':
      case 'datetime':
      case 'datetimetz':
      case 'datetimelocal':
        dbType = 'TIMESTAMP';
        break;
      case 'interval':
      case 'duration':
        // MySQL doesn't have INTERVAL type, use VARCHAR
        dbType = 'VARCHAR(50)';
        break;
        
      // Complex
      case 'json':
      case 'jsonb':
        dbType = 'JSON';
        break;
      case 'binary':
        dbType = 'BLOB';
        break;
      case 'base64':
        dbType = 'TEXT';
        break;
      case 'enum':
        // MySQL supports native ENUM
        if (fieldType.enumValues && fieldType.enumValues.length > 0) {
          const values = fieldType.enumValues.map(v => `'${v.replace(/'/g, "''")}'`).join(',');
          dbType = `ENUM(${values})`;
        } else {
          dbType = 'VARCHAR(50)';
        }
        break;
        
      default:
        dbType = `VARCHAR(${fieldType.length || 255})`;
    }
    
    // MySQL doesn't support array types natively
    // Arrays would need to be stored as JSON
    if (fieldType.array && fieldType.type !== 'json' && fieldType.type !== 'jsonb') {
      dbType = 'JSON';
    }
    
    return dbType;
  }
  
  /**
   * Map field type to SQLite type
   * SQLite has limited types: NULL, INTEGER, REAL, TEXT, BLOB
   */
  static toSQLite(fieldType: FieldType): string {
    // Use override if provided
    if (fieldType.dbType) {
      return fieldType.dbType;
    }
    
    let dbType: string;
    
    switch (fieldType.type) {
      // Strings - all map to TEXT
      case 'string':
      case 'text':
      case 'email':
      case 'url':
      case 'phone':
      case 'slug':
      case 'uuid':
        dbType = 'TEXT';
        break;
        
      // Numbers
      case 'int8':
      case 'int16':
      case 'int':
      case 'int32':
      case 'int64':
      case 'bigint':
      case 'uint':
        dbType = 'INTEGER';
        break;
      case 'decimal':
      case 'money':
      case 'float':
      case 'double':
        dbType = 'REAL';
        break;
        
      // Boolean
      case 'boolean':
        dbType = 'INTEGER'; // SQLite uses 0/1 for boolean
        break;
        
      // Date/Time - all map to TEXT in SQLite
      case 'date':
      case 'time':
      case 'timestamp':
      case 'timestamptz':
      case 'timestamplocal':
      case 'datetime':
      case 'datetimetz':
      case 'datetimelocal':
      case 'interval':
      case 'duration':
        dbType = 'TEXT';
        break;
        
      // Complex
      case 'json':
      case 'jsonb':
        dbType = 'TEXT';
        break;
      case 'binary':
        dbType = 'BLOB';
        break;
      case 'base64':
        dbType = 'TEXT';
        break;
      case 'enum':
        dbType = 'TEXT';
        break;
        
      default:
        dbType = 'TEXT';
    }
    
    // SQLite doesn't support array types natively
    // Arrays would need to be stored as TEXT (JSON)
    if (fieldType.array && fieldType.type !== 'json' && fieldType.type !== 'jsonb') {
      dbType = 'TEXT';
    }
    
    return dbType;
  }
  
  /**
   * Get database type for a specific database engine
   */
  static toDatabase(fieldType: FieldType, engine: 'postgresql' | 'mysql' | 'sqlite'): string {
    switch (engine) {
      case 'postgresql':
        return this.toPostgreSQL(fieldType);
      case 'mysql':
        return this.toMySQL(fieldType);
      case 'sqlite':
        return this.toSQLite(fieldType);
      default:
        throw new Error(`Unsupported database engine: ${engine}`);
    }
  }
}
