import { FieldType } from './types.js';
/**
 * Database Type Mapper
 *
 * Maps YAMA field types to database-specific SQL types.
 * Supports PostgreSQL, MySQL, and SQLite.
 */
export declare class DatabaseTypeMapper {
    /**
     * Map field type to PostgreSQL type
     */
    static toPostgreSQL(fieldType: FieldType): string;
    /**
     * Map field type to MySQL type
     */
    static toMySQL(fieldType: FieldType): string;
    /**
     * Map field type to SQLite type
     * SQLite has limited types: NULL, INTEGER, REAL, TEXT, BLOB
     */
    static toSQLite(fieldType: FieldType): string;
    /**
     * Get database type for a specific database engine
     */
    static toDatabase(fieldType: FieldType, engine: 'postgresql' | 'mysql' | 'sqlite'): string;
}
//# sourceMappingURL=mapper.d.ts.map