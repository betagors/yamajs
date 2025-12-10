/**
 * Type System Type Definitions
 */

/**
 * Base type names supported by YAMA
 */
export type BaseType =
  // String types
  | 'string'
  | 'text'
  | 'email'
  | 'url'
  | 'phone'
  | 'slug'
  | 'uuid'
  
  // Numeric types
  | 'int'
  | 'int8'
  | 'int16'
  | 'int32'
  | 'int64'
  | 'bigint'
  | 'uint'
  | 'decimal'
  | 'money'
  | 'float'
  | 'double'
  
  // Boolean
  | 'boolean'
  
  // Date/Time
  | 'date'
  | 'time'
  | 'timestamp'
  | 'timestamptz'
  | 'timestamplocal'
  | 'datetime'
  | 'datetimetz'
  | 'datetimelocal'
  | 'interval'
  | 'duration'
  
  // Complex types
  | 'json'
  | 'jsonb'
  | 'binary'
  | 'base64'
  | 'enum';

/**
 * Field Type Definition
 * 
 * Represents a parsed field type with all its constraints and metadata
 */
export interface FieldType {
  /** Base type name */
  type: BaseType | string; // string allows for custom types
  
  /** Whether field is nullable */
  nullable: boolean;
  
  /** Whether this is an array type */
  array: boolean;
  
  // Type-specific parameters
  /** String/text length constraint */
  length?: number;
  
  /** Decimal precision */
  precision?: number;
  
  /** Decimal scale */
  scale?: number;
  
  /** Currency code for money type (e.g., 'USD', 'EUR') */
  currency?: string;
  
  /** Enum values */
  enumValues?: string[];
  
  /** Regex pattern for validation */
  pattern?: string;
  
  // Constraints
  /** Minimum value (numeric or date string) */
  min?: number | string;
  
  /** Maximum value (numeric or date string) */
  max?: number | string;
  
  /** Minimum string length */
  minLength?: number;
  
  /** Maximum string length */
  maxLength?: number;
  
  /** Minimum array items */
  minItems?: number;
  
  /** Maximum array items */
  maxItems?: number;
  
  // Default value
  /** Static default value */
  default?: any;
  
  /** Default function name (e.g., 'now', 'gen_uuid') */
  defaultFn?: string;
  
  // Field modifiers
  /** Unique constraint */
  unique?: boolean;
  
  /** Indexed */
  indexed?: boolean;
  
  /** Read-only field */
  readonly?: boolean;
  
  /** Write-only field (e.g., password) */
  writeOnly?: boolean;
  
  /** Sensitive field (excluded from responses by default) */
  sensitive?: boolean;
  
  /** Auto-generated field */
  generated?: boolean;
  
  /** Auto-update field (e.g., updatedAt) */
  autoUpdate?: boolean;
  
  // Database mapping
  /** Override database type */
  dbType?: string;
  
  /** Description/documentation */
  description?: string;
}

/**
 * Parsed field definition from YAML
 * Can be either a concise string or expanded object
 */
export type FieldDefinition = string | FieldType | {
  type: string;
  [key: string]: any;
};
