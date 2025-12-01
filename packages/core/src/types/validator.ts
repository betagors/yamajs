import { FieldType } from './types.js';

/**
 * Validation Rule Generator
 * 
 * Generates database CHECK constraints and validation rules from field types.
 */
export class ValidationGenerator {
  /**
   * Generate CHECK constraints for a field
   * Returns SQL CHECK constraint expressions
   */
  static generateCheckConstraints(
    fieldName: string,
    fieldType: FieldType,
    engine: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'
  ): string[] {
    const constraints: string[] = [];
    const escapedFieldName = this.escapeFieldName(fieldName, engine);
    
    // Numeric ranges
    if (fieldType.min !== undefined) {
      if (typeof fieldType.min === 'number') {
        constraints.push(`${escapedFieldName} >= ${fieldType.min}`);
      } else {
        // Date string - engine specific
        if (engine === 'postgresql') {
          constraints.push(`${escapedFieldName} >= '${fieldType.min}'::date`);
        } else {
          constraints.push(`${escapedFieldName} >= '${fieldType.min}'`);
        }
      }
    }
    if (fieldType.max !== undefined) {
      if (typeof fieldType.max === 'number') {
        constraints.push(`${escapedFieldName} <= ${fieldType.max}`);
      } else {
        // Date string
        if (engine === 'postgresql') {
          constraints.push(`${escapedFieldName} <= '${fieldType.max}'::date`);
        } else {
          constraints.push(`${escapedFieldName} <= '${fieldType.max}'`);
        }
      }
    }
    
    // String length
    if (fieldType.minLength !== undefined) {
      if (engine === 'postgresql') {
        constraints.push(`LENGTH(${escapedFieldName}) >= ${fieldType.minLength}`);
      } else if (engine === 'mysql') {
        constraints.push(`CHAR_LENGTH(${escapedFieldName}) >= ${fieldType.minLength}`);
      } else {
        constraints.push(`LENGTH(${escapedFieldName}) >= ${fieldType.minLength}`);
      }
    }
    if (fieldType.maxLength !== undefined) {
      if (engine === 'postgresql') {
        constraints.push(`LENGTH(${escapedFieldName}) <= ${fieldType.maxLength}`);
      } else if (engine === 'mysql') {
        constraints.push(`CHAR_LENGTH(${escapedFieldName}) <= ${fieldType.maxLength}`);
      } else {
        constraints.push(`LENGTH(${escapedFieldName}) <= ${fieldType.maxLength}`);
      }
    }
    
    // Pattern validation
    if (fieldType.pattern) {
      if (engine === 'postgresql') {
        constraints.push(`${escapedFieldName} ~ '${this.escapeRegex(fieldType.pattern)}'`);
      } else if (engine === 'mysql') {
        constraints.push(`${escapedFieldName} REGEXP '${this.escapeRegex(fieldType.pattern)}'`);
      } else {
        // SQLite doesn't have native regex, would need application-level validation
        // For now, skip
      }
    }
    
    // Type-specific validations
    switch (fieldType.type) {
      case 'email':
        if (engine === 'postgresql') {
          constraints.push(`${escapedFieldName} ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`);
        } else if (engine === 'mysql') {
          constraints.push(`${escapedFieldName} REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\\\.[A-Za-z]{2,}$'`);
        }
        break;
      case 'url':
        if (engine === 'postgresql') {
          constraints.push(`${escapedFieldName} ~* '^https?://[^\\s/$.?#].[^\\s]*$'`);
        } else if (engine === 'mysql') {
          constraints.push(`${escapedFieldName} REGEXP '^https?://[^\\\\s/$.?#].[^\\\\s]*$'`);
        }
        break;
      case 'slug':
        if (engine === 'postgresql') {
          constraints.push(`${escapedFieldName} ~* '^[a-z0-9-]+$'`);
        } else if (engine === 'mysql') {
          constraints.push(`${escapedFieldName} REGEXP '^[a-z0-9-]+$'`);
        }
        break;
      case 'phone':
        if (engine === 'postgresql') {
          constraints.push(`${escapedFieldName} ~* '^\\+?[1-9]\\d{1,14}$'`);
        } else if (engine === 'mysql') {
          constraints.push(`${escapedFieldName} REGEXP '^\\\\+?[1-9]\\\\d{1,14}$'`);
        }
        break;
      case 'uint':
        constraints.push(`${escapedFieldName} >= 0`);
        break;
    }
    
    // Array constraints
    if (fieldType.array) {
      if (engine === 'postgresql') {
        if (fieldType.minItems !== undefined) {
          constraints.push(`array_length(${escapedFieldName}, 1) >= ${fieldType.minItems}`);
        }
        if (fieldType.maxItems !== undefined) {
          constraints.push(`array_length(${escapedFieldName}, 1) <= ${fieldType.maxItems}`);
        }
      }
      // MySQL and SQLite don't support array constraints natively
    }
    
    return constraints;
  }
  
  /**
   * Generate a complete CHECK constraint SQL statement
   */
  static generateCheckConstraintSQL(
    tableName: string,
    fieldName: string,
    fieldType: FieldType,
    engine: 'postgresql' | 'mysql' | 'sqlite' = 'postgresql'
  ): string | null {
    const constraints = this.generateCheckConstraints(fieldName, fieldType, engine);
    
    if (constraints.length === 0) {
      return null;
    }
    
    const constraintName = this.getConstraintName(tableName, fieldName);
    const escapedTableName = this.escapeFieldName(tableName, engine);
    const constraintExpr = constraints.join(' AND ');
    
    if (engine === 'postgresql') {
      return `ALTER TABLE ${escapedTableName} ADD CONSTRAINT ${constraintName} CHECK (${constraintExpr});`;
    } else if (engine === 'mysql') {
      return `ALTER TABLE ${escapedTableName} ADD CONSTRAINT ${constraintName} CHECK (${constraintExpr});`;
    } else {
      // SQLite - CHECK constraints are added in CREATE TABLE
      return `CHECK (${constraintExpr})`;
    }
  }
  
  /**
   * Escape field name for SQL
   */
  private static escapeFieldName(name: string, engine: 'postgresql' | 'mysql' | 'sqlite'): string {
    if (engine === 'postgresql' || engine === 'sqlite') {
      return `"${name.replace(/"/g, '""')}"`;
    } else {
      // MySQL uses backticks
      return `\`${name.replace(/`/g, '``')}\``;
    }
  }
  
  /**
   * Escape regex pattern for SQL
   */
  private static escapeRegex(pattern: string): string {
    // Escape single quotes for SQL
    return pattern.replace(/'/g, "''");
  }
  
  /**
   * Generate constraint name
   */
  private static getConstraintName(tableName: string, fieldName: string): string {
    return `chk_${tableName}_${fieldName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  }
  
  /**
   * Generate validation rules for runtime validation (e.g., Zod schemas)
   */
  static generateValidationRules(fieldType: FieldType): Record<string, any> {
    const rules: Record<string, any> = {};
    
    // Type
    rules.type = fieldType.type;
    
    // Nullable
    if (fieldType.nullable) {
      rules.nullable = true;
    }
    
    // Array
    if (fieldType.array) {
      rules.array = true;
    }
    
    // Constraints
    if (fieldType.min !== undefined) rules.min = fieldType.min;
    if (fieldType.max !== undefined) rules.max = fieldType.max;
    if (fieldType.minLength !== undefined) rules.minLength = fieldType.minLength;
    if (fieldType.maxLength !== undefined) rules.maxLength = fieldType.maxLength;
    if (fieldType.minItems !== undefined) rules.minItems = fieldType.minItems;
    if (fieldType.maxItems !== undefined) rules.maxItems = fieldType.maxItems;
    if (fieldType.pattern !== undefined) rules.pattern = fieldType.pattern;
    if (fieldType.enumValues !== undefined) rules.enum = fieldType.enumValues;
    if (fieldType.precision !== undefined) rules.precision = fieldType.precision;
    if (fieldType.scale !== undefined) rules.scale = fieldType.scale;
    if (fieldType.currency !== undefined) rules.currency = fieldType.currency;
    
    // Default
    if (fieldType.default !== undefined) rules.default = fieldType.default;
    if (fieldType.defaultFn !== undefined) rules.defaultFn = fieldType.defaultFn;
    
    return rules;
  }
}
