import { FieldType } from './types.js';
/**
 * Validation Rule Generator
 *
 * Generates database CHECK constraints and validation rules from field types.
 */
export declare class ValidationGenerator {
    /**
     * Generate CHECK constraints for a field
     * Returns SQL CHECK constraint expressions
     */
    static generateCheckConstraints(fieldName: string, fieldType: FieldType, engine?: 'postgresql' | 'mysql' | 'sqlite'): string[];
    /**
     * Generate a complete CHECK constraint SQL statement
     */
    static generateCheckConstraintSQL(tableName: string, fieldName: string, fieldType: FieldType, engine?: 'postgresql' | 'mysql' | 'sqlite'): string | null;
    /**
     * Escape field name for SQL
     */
    private static escapeFieldName;
    /**
     * Escape regex pattern for SQL
     */
    private static escapeRegex;
    /**
     * Generate constraint name
     */
    private static getConstraintName;
    /**
     * Generate validation rules for runtime validation (e.g., Zod schemas)
     */
    static generateValidationRules(fieldType: FieldType): Record<string, any>;
}
//# sourceMappingURL=validator.d.ts.map