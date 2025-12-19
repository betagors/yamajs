/**
 * Yama Core Scalar Types
 * 
 * v1.0 Core Scalars:
 * - string, text, int, bigint, float, boolean
 * - uuid, timestamp, date, time, json, binary
 * 
 * Special: id (shortcut for uuid primary key)
 * 
 * Extensible via plugins for custom scalars (@email, @url, @money, etc.)
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Validation result from a scalar validator
 */
export interface ScalarValidationResult {
    valid: boolean;
    error?: string;
    /** Coerced/normalized value */
    value?: unknown;
}

/**
 * Scalar type definition
 */
export interface ScalarTypeDefinition {
    /** Unique type name */
    name: string;

    /** Human-readable description */
    description: string;

    /** TypeScript type representation */
    tsType: string;

    /** Default database type hint (can be overridden by adapters) */
    dbTypeHint: string;

    /** 
     * Validate a value against this scalar type
     * Returns validation result with optional coerced value
     */
    validate: (value: unknown, options?: ScalarValidateOptions) => ScalarValidationResult;

    /**
     * Parse a string value into the proper type
     * Used for parsing from YAML defaults, URL params, etc.
     */
    parse?: (value: string) => unknown;

    /**
     * Serialize a value to JSON-compatible format
     */
    serialize?: (value: unknown) => unknown;

    /**
     * Generate a default value (for 'id' with auto-generation)
     */
    generateDefault?: () => unknown;

    /** Whether this type can be a primary key */
    canBePrimaryKey?: boolean;

    /** Whether this type supports array notation */
    supportsArray?: boolean;

    /** Source: 'core' | plugin name */
    source: string;
}

/**
 * Options for scalar validation
 */
export interface ScalarValidateOptions {
    /** Allow null values (for optional fields) */
    nullable?: boolean;
    /** Coerce types if possible (e.g., string "42" to number 42) */
    coerce?: boolean;
    /** Min value (for numbers) or min length (for strings) */
    min?: number;
    /** Max value (for numbers) or max length (for strings) */
    max?: number;
    /** Minimum length (strings) */
    minLength?: number;
    /** Maximum length (strings) */
    maxLength?: number;
    /** Regex pattern (strings) */
    pattern?: string;
    /** Allowed enum values */
    enumValues?: string[];
    /** Decimal precision */
    precision?: number;
    /** Decimal scale */
    scale?: number;
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * UUID v4 regex pattern
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * ISO 8601 date regex (YYYY-MM-DD)
 */
const ISO_DATE_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * ISO 8601 time regex (HH:MM:SS or HH:MM:SS.sss)
 */
const ISO_TIME_REGEX = /^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?$/;

/**
 * ISO 8601 datetime regex
 */
const ISO_DATETIME_REGEX = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;

/**
 * Simple UUID v4 generator (browser-safe)
 */
function generateUuidV4(): string {
    // Use crypto if available
    if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    // Fallback for environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Validate null/undefined with nullable option
 */
function validateNullable(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult | null {
    if (value === null || value === undefined) {
        if (options?.nullable !== false) {
            return { valid: true, value: null };
        }
        return { valid: false, error: 'Value is required' };
    }
    return null; // Continue with type-specific validation
}

// ============================================================================
// Core Scalar Type Definitions
// ============================================================================

/**
 * String scalar type
 */
export const StringScalar: ScalarTypeDefinition = {
    name: 'string',
    description: 'UTF-8 string (default max 255 characters)',
    tsType: 'string',
    dbTypeHint: 'VARCHAR(255)',
    source: 'core',
    supportsArray: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        // Coerce if allowed
        let str: string;
        if (typeof value === 'string') {
            str = value;
        } else if (options?.coerce && (typeof value === 'number' || typeof value === 'boolean')) {
            str = String(value);
        } else {
            return { valid: false, error: `Expected string, got ${typeof value}` };
        }

        // Length validation
        if (options?.minLength !== undefined && str.length < options.minLength) {
            return { valid: false, error: `String must be at least ${options.minLength} characters` };
        }
        if (options?.maxLength !== undefined && str.length > options.maxLength) {
            return { valid: false, error: `String must be at most ${options.maxLength} characters` };
        }

        // Pattern validation
        if (options?.pattern) {
            const regex = new RegExp(options.pattern);
            if (!regex.test(str)) {
                return { valid: false, error: `String does not match pattern: ${options.pattern}` };
            }
        }

        // Enum validation
        if (options?.enumValues && !options.enumValues.includes(str)) {
            return { valid: false, error: `Value must be one of: ${options.enumValues.join(', ')}` };
        }

        return { valid: true, value: str };
    },

    parse(value: string): string {
        return value;
    },

    serialize(value: unknown): string {
        return String(value);
    }
};

/**
 * Text scalar type (long strings, no length limit)
 */
export const TextScalar: ScalarTypeDefinition = {
    name: 'text',
    description: 'Long text (no length limit)',
    tsType: 'string',
    dbTypeHint: 'TEXT',
    source: 'core',
    supportsArray: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        if (typeof value !== 'string') {
            if (options?.coerce) {
                return { valid: true, value: String(value) };
            }
            return { valid: false, error: `Expected string, got ${typeof value}` };
        }

        // Min/max length still applies if specified
        if (options?.minLength !== undefined && value.length < options.minLength) {
            return { valid: false, error: `Text must be at least ${options.minLength} characters` };
        }
        if (options?.maxLength !== undefined && value.length > options.maxLength) {
            return { valid: false, error: `Text must be at most ${options.maxLength} characters` };
        }

        return { valid: true, value };
    },

    parse(value: string): string {
        return value;
    },

    serialize(value: unknown): string {
        return String(value);
    }
};

/**
 * Int scalar type (32-bit signed integer)
 */
export const IntScalar: ScalarTypeDefinition = {
    name: 'int',
    description: '32-bit signed integer (-2,147,483,648 to 2,147,483,647)',
    tsType: 'number',
    dbTypeHint: 'INTEGER',
    source: 'core',
    supportsArray: true,
    canBePrimaryKey: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        let num: number;

        if (typeof value === 'number') {
            num = value;
        } else if (options?.coerce && typeof value === 'string') {
            num = parseInt(value, 10);
            if (isNaN(num)) {
                return { valid: false, error: `Cannot parse "${value}" as integer` };
            }
        } else {
            return { valid: false, error: `Expected number, got ${typeof value}` };
        }

        // Check integer
        if (!Number.isInteger(num)) {
            return { valid: false, error: 'Value must be an integer' };
        }

        // 32-bit range
        const INT32_MIN = -2147483648;
        const INT32_MAX = 2147483647;

        const min = options?.min !== undefined ? Math.max(options.min, INT32_MIN) : INT32_MIN;
        const max = options?.max !== undefined ? Math.min(options.max, INT32_MAX) : INT32_MAX;

        if (num < min) {
            return { valid: false, error: `Value must be at least ${min}` };
        }
        if (num > max) {
            return { valid: false, error: `Value must be at most ${max}` };
        }

        return { valid: true, value: num };
    },

    parse(value: string): number {
        return parseInt(value, 10);
    },

    serialize(value: unknown): number {
        return Number(value);
    }
};

/**
 * Bigint scalar type (64-bit integer, JavaScript BigInt or number)
 */
export const BigIntScalar: ScalarTypeDefinition = {
    name: 'bigint',
    description: '64-bit integer (arbitrary precision in JavaScript)',
    tsType: 'bigint | number',
    dbTypeHint: 'BIGINT',
    source: 'core',
    supportsArray: true,
    canBePrimaryKey: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        let num: bigint | number;

        if (typeof value === 'bigint') {
            num = value;
        } else if (typeof value === 'number') {
            if (!Number.isInteger(value)) {
                return { valid: false, error: 'Value must be an integer' };
            }
            num = value;
        } else if (options?.coerce && typeof value === 'string') {
            try {
                // Try BigInt first for large numbers
                num = BigInt(value);
            } catch {
                const parsed = parseInt(value, 10);
                if (isNaN(parsed)) {
                    return { valid: false, error: `Cannot parse "${value}" as bigint` };
                }
                num = parsed;
            }
        } else {
            return { valid: false, error: `Expected number or bigint, got ${typeof value}` };
        }

        // Range validation
        if (options?.min !== undefined) {
            const minBig = typeof options.min === 'bigint' ? options.min : BigInt(options.min);
            const numBig = typeof num === 'bigint' ? num : BigInt(num);
            if (numBig < minBig) {
                return { valid: false, error: `Value must be at least ${options.min}` };
            }
        }
        if (options?.max !== undefined) {
            const maxBig = typeof options.max === 'bigint' ? options.max : BigInt(options.max);
            const numBig = typeof num === 'bigint' ? num : BigInt(num);
            if (numBig > maxBig) {
                return { valid: false, error: `Value must be at most ${options.max}` };
            }
        }

        return { valid: true, value: num };
    },

    parse(value: string): bigint | number {
        try {
            return BigInt(value);
        } catch {
            return parseInt(value, 10);
        }
    },

    serialize(value: unknown): string | number {
        // JSON doesn't support BigInt, serialize as string for large values
        if (typeof value === 'bigint') {
            if (value > Number.MAX_SAFE_INTEGER || value < Number.MIN_SAFE_INTEGER) {
                return value.toString();
            }
            return Number(value);
        }
        return Number(value);
    }
};

/**
 * Float scalar type (64-bit floating point)
 */
export const FloatScalar: ScalarTypeDefinition = {
    name: 'float',
    description: '64-bit floating point number',
    tsType: 'number',
    dbTypeHint: 'DOUBLE PRECISION',
    source: 'core',
    supportsArray: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        let num: number;

        if (typeof value === 'number') {
            num = value;
        } else if (options?.coerce && typeof value === 'string') {
            num = parseFloat(value);
            if (isNaN(num)) {
                return { valid: false, error: `Cannot parse "${value}" as float` };
            }
        } else {
            return { valid: false, error: `Expected number, got ${typeof value}` };
        }

        if (!Number.isFinite(num)) {
            return { valid: false, error: 'Value must be a finite number' };
        }

        // Range validation
        if (options?.min !== undefined && num < options.min) {
            return { valid: false, error: `Value must be at least ${options.min}` };
        }
        if (options?.max !== undefined && num > options.max) {
            return { valid: false, error: `Value must be at most ${options.max}` };
        }

        // Precision/Scale validation (for money-like use)
        if (options?.scale !== undefined) {
            const scaled = parseFloat(num.toFixed(options.scale));
            return { valid: true, value: scaled };
        }

        return { valid: true, value: num };
    },

    parse(value: string): number {
        return parseFloat(value);
    },

    serialize(value: unknown): number {
        return Number(value);
    }
};

/**
 * Boolean scalar type
 */
export const BooleanScalar: ScalarTypeDefinition = {
    name: 'boolean',
    description: 'Boolean true/false value',
    tsType: 'boolean',
    dbTypeHint: 'BOOLEAN',
    source: 'core',
    supportsArray: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        if (typeof value === 'boolean') {
            return { valid: true, value };
        }

        if (options?.coerce) {
            // String coercion
            if (typeof value === 'string') {
                const lower = value.toLowerCase();
                if (['true', '1', 'yes', 'on'].includes(lower)) {
                    return { valid: true, value: true };
                }
                if (['false', '0', 'no', 'off'].includes(lower)) {
                    return { valid: true, value: false };
                }
            }
            // Number coercion
            if (typeof value === 'number') {
                return { valid: true, value: value !== 0 };
            }
        }

        return { valid: false, error: `Expected boolean, got ${typeof value}` };
    },

    parse(value: string): boolean {
        return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
    },

    serialize(value: unknown): boolean {
        return Boolean(value);
    }
};

/**
 * UUID scalar type (UUID v4)
 */
export const UuidScalar: ScalarTypeDefinition = {
    name: 'uuid',
    description: 'UUID v4 (auto-generated if primary key)',
    tsType: 'string',
    dbTypeHint: 'UUID',
    source: 'core',
    supportsArray: true,
    canBePrimaryKey: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        if (typeof value !== 'string') {
            return { valid: false, error: `Expected string UUID, got ${typeof value}` };
        }

        if (!UUID_REGEX.test(value)) {
            return { valid: false, error: 'Invalid UUID format' };
        }

        return { valid: true, value: value.toLowerCase() };
    },

    parse(value: string): string {
        return value.toLowerCase();
    },

    serialize(value: unknown): string {
        return String(value).toLowerCase();
    },

    generateDefault(): string {
        return generateUuidV4();
    }
};

/**
 * Timestamp scalar type (ISO 8601 datetime with timezone)
 */
export const TimestampScalar: ScalarTypeDefinition = {
    name: 'timestamp',
    description: 'ISO 8601 date-time with timezone',
    tsType: 'string | Date',
    dbTypeHint: 'TIMESTAMP WITH TIME ZONE',
    source: 'core',
    supportsArray: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        let dateStr: string;
        let dateObj: Date;

        if (value instanceof Date) {
            if (isNaN(value.getTime())) {
                return { valid: false, error: 'Invalid Date object' };
            }
            dateObj = value;
            dateStr = value.toISOString();
        } else if (typeof value === 'string') {
            dateStr = value;
            dateObj = new Date(value);
            if (isNaN(dateObj.getTime())) {
                return { valid: false, error: `Invalid timestamp: "${value}"` };
            }
        } else if (options?.coerce && typeof value === 'number') {
            dateObj = new Date(value);
            if (isNaN(dateObj.getTime())) {
                return { valid: false, error: 'Invalid timestamp number' };
            }
            dateStr = dateObj.toISOString();
        } else {
            return { valid: false, error: `Expected timestamp string or Date, got ${typeof value}` };
        }

        // Range validation
        if (options?.min !== undefined) {
            const minDate = new Date(options.min);
            if (dateObj < minDate) {
                return { valid: false, error: `Timestamp must be after ${options.min}` };
            }
        }
        if (options?.max !== undefined) {
            const maxDate = new Date(options.max);
            if (dateObj > maxDate) {
                return { valid: false, error: `Timestamp must be before ${options.max}` };
            }
        }

        return { valid: true, value: dateStr };
    },

    parse(value: string): string {
        return new Date(value).toISOString();
    },

    serialize(value: unknown): string {
        if (value instanceof Date) {
            return value.toISOString();
        }
        return String(value);
    },

    generateDefault(): string {
        return new Date().toISOString();
    }
};

/**
 * Date scalar type (ISO 8601 date only: YYYY-MM-DD)
 */
export const DateScalar: ScalarTypeDefinition = {
    name: 'date',
    description: 'ISO 8601 date only (YYYY-MM-DD)',
    tsType: 'string',
    dbTypeHint: 'DATE',
    source: 'core',
    supportsArray: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        let dateStr: string;

        if (value instanceof Date) {
            if (isNaN(value.getTime())) {
                return { valid: false, error: 'Invalid Date object' };
            }
            dateStr = value.toISOString().split('T')[0];
        } else if (typeof value === 'string') {
            // Accept both full ISO and date-only
            if (ISO_DATE_REGEX.test(value)) {
                dateStr = value;
            } else if (ISO_DATETIME_REGEX.test(value)) {
                dateStr = value.split('T')[0];
            } else {
                // Try to parse
                const parsed = new Date(value);
                if (isNaN(parsed.getTime())) {
                    return { valid: false, error: `Invalid date: "${value}"` };
                }
                dateStr = parsed.toISOString().split('T')[0];
            }
        } else {
            return { valid: false, error: `Expected date string, got ${typeof value}` };
        }

        // Final format check
        if (!ISO_DATE_REGEX.test(dateStr)) {
            return { valid: false, error: `Invalid date format: "${dateStr}"` };
        }

        // Range validation
        if (options?.min !== undefined) {
            if (dateStr < String(options.min)) {
                return { valid: false, error: `Date must be after ${options.min}` };
            }
        }
        if (options?.max !== undefined) {
            if (dateStr > String(options.max)) {
                return { valid: false, error: `Date must be before ${options.max}` };
            }
        }

        return { valid: true, value: dateStr };
    },

    parse(value: string): string {
        if (ISO_DATE_REGEX.test(value)) {
            return value;
        }
        return new Date(value).toISOString().split('T')[0];
    },

    serialize(value: unknown): string {
        if (value instanceof Date) {
            return value.toISOString().split('T')[0];
        }
        return String(value);
    },

    generateDefault(): string {
        return new Date().toISOString().split('T')[0];
    }
};

/**
 * Time scalar type (ISO 8601 time only: HH:MM:SS)
 */
export const TimeScalar: ScalarTypeDefinition = {
    name: 'time',
    description: 'ISO 8601 time only (HH:MM:SS)',
    tsType: 'string',
    dbTypeHint: 'TIME',
    source: 'core',
    supportsArray: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        if (typeof value !== 'string') {
            return { valid: false, error: `Expected time string, got ${typeof value}` };
        }

        // Allow HH:MM format as well
        const timeMatch = value.match(/^(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/);
        if (!timeMatch) {
            return { valid: false, error: `Invalid time format: "${value}"` };
        }

        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        const seconds = timeMatch[3] ? parseInt(timeMatch[3], 10) : 0;

        if (hours > 23 || minutes > 59 || seconds > 59) {
            return { valid: false, error: `Invalid time values: "${value}"` };
        }

        // Normalize to HH:MM:SS format
        const normalizedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        return { valid: true, value: normalizedTime };
    },

    parse(value: string): string {
        return value;
    },

    serialize(value: unknown): string {
        return String(value);
    },

    generateDefault(): string {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
};

/**
 * JSON scalar type (arbitrary JSON structure)
 */
export const JsonScalar: ScalarTypeDefinition = {
    name: 'json',
    description: 'Arbitrary JSON object or array',
    tsType: 'Record<string, unknown> | unknown[]',
    dbTypeHint: 'JSONB',
    source: 'core',
    supportsArray: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        // If already an object or array, it's valid JSON
        if (typeof value === 'object') {
            return { valid: true, value };
        }

        // Try to parse string as JSON
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                return { valid: true, value: parsed };
            } catch {
                return { valid: false, error: 'Invalid JSON string' };
            }
        }

        // Primitives are valid JSON
        if (['number', 'boolean'].includes(typeof value)) {
            return { valid: true, value };
        }

        return { valid: false, error: `Cannot convert ${typeof value} to JSON` };
    },

    parse(value: string): unknown {
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    },

    serialize(value: unknown): unknown {
        return value; // JSON is already serializable
    }
};

/**
 * Binary scalar type (raw bytes)
 */
export const BinaryScalar: ScalarTypeDefinition = {
    name: 'binary',
    description: 'Raw binary data (Buffer, Uint8Array, or base64 string)',
    tsType: 'Buffer | Uint8Array | string',
    dbTypeHint: 'BYTEA',
    source: 'core',
    supportsArray: false, // Binary arrays don't make sense

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        const nullCheck = validateNullable(value, options);
        if (nullCheck) return nullCheck;

        // Accept Buffer, Uint8Array, ArrayBuffer
        // Check for Buffer via globalThis to avoid TS errors
        const globalBuffer = (globalThis as any).Buffer;
        if (value instanceof Uint8Array || (globalBuffer && globalBuffer.isBuffer(value))) {
            // Size validation
            const size = (value as Uint8Array).length;
            if (options?.min !== undefined && size < options.min) {
                return { valid: false, error: `Binary data must be at least ${options.min} bytes` };
            }
            if (options?.max !== undefined && size > options.max) {
                return { valid: false, error: `Binary data must be at most ${options.max} bytes` };
            }
            return { valid: true, value };
        }

        // Accept base64 string
        if (typeof value === 'string') {
            // Basic base64 validation
            const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
            if (!base64Regex.test(value.replace(/\s/g, ''))) {
                return { valid: false, error: 'Invalid base64 string' };
            }
            // Estimate decoded size
            const estimatedSize = Math.ceil(value.replace(/=/g, '').length * 0.75);
            if (options?.min !== undefined && estimatedSize < options.min) {
                return { valid: false, error: `Binary data must be at least ${options.min} bytes` };
            }
            if (options?.max !== undefined && estimatedSize > options.max) {
                return { valid: false, error: `Binary data must be at most ${options.max} bytes` };
            }
            return { valid: true, value };
        }

        return { valid: false, error: `Expected binary data, got ${typeof value}` };
    },

    parse(value: string): string {
        // Return as-is (base64)
        return value;
    },

    serialize(value: unknown): string {
        const globalBuffer = (globalThis as any).Buffer;
        if (globalBuffer && globalBuffer.isBuffer(value)) {
            return (value as any).toString('base64');
        }
        if (value instanceof Uint8Array) {
            // Browser-safe base64 encoding
            let binary = '';
            for (let i = 0; i < value.length; i++) {
                binary += String.fromCharCode(value[i]);
            }
            // Use global btoa if available
            if (typeof btoa === 'function') {
                return btoa(binary);
            }
            // Fallback for environments without btoa (should handle in RuntimeAdapter but this is a scalar type)
            // Just return hex or similar if btoa missing? Or error?
            // Assuming btoa or Buffer exists.
            return binary; // fallback (invalid base64 likely)
        }
        return String(value);
    }
};

/**
 * ID scalar type - special shortcut for uuid primary key
 * When used as `id: id`, it means auto-generated uuid primary key
 */
export const IdScalar: ScalarTypeDefinition = {
    name: 'id',
    description: 'Auto-generated UUID primary key (shortcut)',
    tsType: 'string',
    dbTypeHint: 'UUID',
    source: 'core',
    supportsArray: false, // ID is always single value
    canBePrimaryKey: true,

    validate(value: unknown, options?: ScalarValidateOptions): ScalarValidationResult {
        // ID uses UUID validation
        return UuidScalar.validate(value, options);
    },

    parse(value: string): string {
        return value.toLowerCase();
    },

    serialize(value: unknown): string {
        return String(value).toLowerCase();
    },

    generateDefault(): string {
        return generateUuidV4();
    }
};

// ============================================================================
// Scalar Registry
// ============================================================================

/**
 * All core scalar types
 */
export const CORE_SCALARS: ScalarTypeDefinition[] = [
    StringScalar,
    TextScalar,
    IntScalar,
    BigIntScalar,
    FloatScalar,
    BooleanScalar,
    UuidScalar,
    TimestampScalar,
    DateScalar,
    TimeScalar,
    JsonScalar,
    BinaryScalar,
    IdScalar,
];

/**
 * Map of scalar name to definition
 */
export const CORE_SCALAR_MAP: Map<string, ScalarTypeDefinition> = new Map(
    CORE_SCALARS.map(s => [s.name, s])
);

/**
 * Scalar Registry - allows plugins to register custom scalars
 */
export class ScalarRegistry {
    private scalars: Map<string, ScalarTypeDefinition> = new Map(CORE_SCALAR_MAP);

    /**
     * Register a custom scalar type
     */
    register(scalar: ScalarTypeDefinition): void {
        if (this.scalars.has(scalar.name)) {
            const existing = this.scalars.get(scalar.name)!;
            if (existing.source === 'core') {
                throw new Error(`Cannot override core scalar type: ${scalar.name}`);
            }
            // Allow plugin to override another plugin's scalar (last one wins)
        }
        this.scalars.set(scalar.name, scalar);
    }

    /**
     * Get a scalar by name
     */
    get(name: string): ScalarTypeDefinition | undefined {
        return this.scalars.get(name);
    }

    /**
     * Check if a scalar exists
     */
    has(name: string): boolean {
        return this.scalars.has(name);
    }

    /**
     * Get all registered scalars
     */
    getAll(): ScalarTypeDefinition[] {
        return Array.from(this.scalars.values());
    }

    /**
     * Get core scalar names
     */
    getCoreNames(): string[] {
        return CORE_SCALARS.map(s => s.name);
    }

    /**
     * Check if a type name is a core scalar
     */
    isCoreScalar(name: string): boolean {
        return CORE_SCALAR_MAP.has(name);
    }

    /**
     * Validate a value against a scalar type
     */
    validate(
        typeName: string,
        value: unknown,
        options?: ScalarValidateOptions
    ): ScalarValidationResult {
        const scalar = this.scalars.get(typeName);
        if (!scalar) {
            return { valid: false, error: `Unknown scalar type: ${typeName}` };
        }
        return scalar.validate(value, options);
    }
}

/**
 * Default global scalar registry instance
 */
export const scalarRegistry = new ScalarRegistry();

/**
 * Get a scalar validator by name
 */
export function getScalarValidator(name: string): ScalarTypeDefinition | undefined {
    return scalarRegistry.get(name);
}

/**
 * Register a custom scalar type
 */
export function registerScalar(scalar: ScalarTypeDefinition): void {
    scalarRegistry.register(scalar);
}

/**
 * Validate a value against a scalar type
 */
export function validateScalar(
    typeName: string,
    value: unknown,
    options?: ScalarValidateOptions
): ScalarValidationResult {
    return scalarRegistry.validate(typeName, value, options);
}

/**
 * Check if a type name is a known scalar (core or plugin)
 */
export function isScalarType(name: string): boolean {
    return scalarRegistry.has(name);
}

/**
 * Check if a type name is a core scalar
 */
export function isCoreScalarType(name: string): boolean {
    return scalarRegistry.isCoreScalar(name);
}
