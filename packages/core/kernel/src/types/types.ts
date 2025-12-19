/**
 * Type System Type Definitions
 * 
 * Yama v1.0 Type System
 */

/**
 * V1.0 Core Scalar Types
 * These are the built-in types shipped with @yamajs/core
 */
export type CoreScalarType =
  // Text types
  | 'string'      // UTF-8 string (max 255 by default)
  | 'text'        // Long text (no limit)

  // Numeric types
  | 'int'         // 32-bit signed integer
  | 'bigint'      // 64-bit integer
  | 'float'       // 64-bit floating point

  // Boolean
  | 'boolean'     // true/false

  // Identifiers
  | 'uuid'        // UUID v4
  | 'id'          // Shortcut for uuid primary key

  // Date/Time
  | 'timestamp'   // ISO 8601 datetime with timezone
  | 'date'        // ISO 8601 date only (YYYY-MM-DD)
  | 'time'        // ISO 8601 time only (HH:MM:SS)

  // Complex
  | 'json'        // Arbitrary JSON object/array
  | 'binary';     // Raw bytes (Buffer/base64)

/**
 * Extended types (from legacy, will be moved to plugins in v2)
 * Kept for backwards compatibility
 */
export type ExtendedType =
  // String variants (move to validation directives)
  | 'email'       // -> string @email
  | 'url'         // -> string @url
  | 'phone'       // -> string @phone
  | 'slug'        // -> string @slug

  // Integer variants
  | 'int8'        // -> int(min: -128, max: 127)
  | 'int16'       // -> int(min: -32768, max: 32767)
  | 'int32'       // -> int
  | 'int64'       // -> bigint
  | 'uint'        // -> int(min: 0)

  // Decimal types
  | 'decimal'     // -> float with precision/scale
  | 'money'       // -> float @money or decimal
  | 'double'      // -> float

  // Timestamp variants
  | 'timestamptz'
  | 'timestamplocal'
  | 'datetime'
  | 'datetimetz'
  | 'datetimelocal'
  | 'interval'
  | 'duration'

  // JSON variants
  | 'jsonb'       // -> json (adapter handles JSONB)
  | 'base64'      // -> binary

  // Enum (handled specially)
  | 'enum';

/**
 * Base type names supported by YAMA
 * Includes both v1.0 core types and extended types for compatibility
 */
export type BaseType = CoreScalarType | ExtendedType;

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
