/**
 * Yama Type System Tests
 * 
 * Comprehensive tests for v1.0 core scalar types
 */

import { describe, it, expect } from 'vitest';
import {
    // Scalar types
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

    // Registry
    scalarRegistry,
    validateScalar,
    isScalarType,
    isCoreScalarType,
    registerScalar,

    // Type definitions
    type ScalarTypeDefinition,
} from '../scalars.js';

import {
    // Relation detection
    isRelationType,
    isRelationTypeName,
    extractBaseName,
    isArrayType,
    isRequiredType,
    classifyType,
    parseRelationType,
} from '../relations.js';

import { TypeParser } from '../parser.js';

// ============================================================================
// String Scalar Tests
// ============================================================================

describe('StringScalar', () => {
    it('validates string values', () => {
        expect(StringScalar.validate('hello')).toEqual({ valid: true, value: 'hello' });
        expect(StringScalar.validate('')).toEqual({ valid: true, value: '' });
    });

    it('rejects non-string values without coercion', () => {
        expect(StringScalar.validate(123).valid).toBe(false);
        expect(StringScalar.validate(true).valid).toBe(false);
        expect(StringScalar.validate({}).valid).toBe(false);
    });

    it('coerces values when enabled', () => {
        expect(StringScalar.validate(123, { coerce: true })).toEqual({ valid: true, value: '123' });
        expect(StringScalar.validate(true, { coerce: true })).toEqual({ valid: true, value: 'true' });
    });

    it('validates length constraints', () => {
        expect(StringScalar.validate('hi', { minLength: 3 }).valid).toBe(false);
        expect(StringScalar.validate('hello', { minLength: 3 })).toEqual({ valid: true, value: 'hello' });
        expect(StringScalar.validate('hello world', { maxLength: 5 }).valid).toBe(false);
        expect(StringScalar.validate('hello', { maxLength: 10 })).toEqual({ valid: true, value: 'hello' });
    });

    it('validates regex patterns', () => {
        expect(StringScalar.validate('abc123', { pattern: '^[a-z]+$' }).valid).toBe(false);
        expect(StringScalar.validate('abc', { pattern: '^[a-z]+$' })).toEqual({ valid: true, value: 'abc' });
    });

    it('validates enum values', () => {
        const opts = { enumValues: ['red', 'green', 'blue'] };
        expect(StringScalar.validate('red', opts)).toEqual({ valid: true, value: 'red' });
        expect(StringScalar.validate('yellow', opts).valid).toBe(false);
    });

    it('handles null/undefined with nullable option', () => {
        expect(StringScalar.validate(null)).toEqual({ valid: true, value: null });
        expect(StringScalar.validate(null, { nullable: false }).valid).toBe(false);
        expect(StringScalar.validate(undefined)).toEqual({ valid: true, value: null });
    });
});

// ============================================================================
// Text Scalar Tests
// ============================================================================

describe('TextScalar', () => {
    it('validates text values', () => {
        const longText = 'a'.repeat(10000);
        expect(TextScalar.validate(longText)).toEqual({ valid: true, value: longText });
    });

    it('coerces non-string values', () => {
        expect(TextScalar.validate(42, { coerce: true })).toEqual({ valid: true, value: '42' });
    });
});

// ============================================================================
// Int Scalar Tests
// ============================================================================

describe('IntScalar', () => {
    it('validates integer values', () => {
        expect(IntScalar.validate(42)).toEqual({ valid: true, value: 42 });
        expect(IntScalar.validate(0)).toEqual({ valid: true, value: 0 });
        expect(IntScalar.validate(-100)).toEqual({ valid: true, value: -100 });
    });

    it('rejects non-integer values', () => {
        expect(IntScalar.validate(3.14).valid).toBe(false);
        expect(IntScalar.validate('42').valid).toBe(false);
    });

    it('coerces strings to integers', () => {
        expect(IntScalar.validate('42', { coerce: true })).toEqual({ valid: true, value: 42 });
        expect(IntScalar.validate('3.14', { coerce: true }).valid).toBe(false); // Not an integer
    });

    it('validates 32-bit range', () => {
        // Max 32-bit: 2147483647
        expect(IntScalar.validate(2147483647)).toEqual({ valid: true, value: 2147483647 });
        expect(IntScalar.validate(2147483648).valid).toBe(false);
        expect(IntScalar.validate(-2147483648)).toEqual({ valid: true, value: -2147483648 });
        expect(IntScalar.validate(-2147483649).valid).toBe(false);
    });

    it('validates custom min/max', () => {
        expect(IntScalar.validate(5, { min: 10 }).valid).toBe(false);
        expect(IntScalar.validate(15, { min: 10 })).toEqual({ valid: true, value: 15 });
        expect(IntScalar.validate(100, { max: 50 }).valid).toBe(false);
    });
});

// ============================================================================
// BigInt Scalar Tests
// ============================================================================

describe('BigIntScalar', () => {
    it('validates bigint values', () => {
        expect(BigIntScalar.validate(BigInt(9007199254740992)).valid).toBe(true);
        expect(BigIntScalar.validate(42).valid).toBe(true);
    });

    it('coerces strings to bigint', () => {
        const result = BigIntScalar.validate('9007199254740992', { coerce: true });
        expect(result.valid).toBe(true);
    });

    it('serializes large bigints as strings', () => {
        expect(BigIntScalar.serialize!(BigInt(9007199254740992))).toBe('9007199254740992');
        expect(BigIntScalar.serialize!(BigInt(42))).toBe(42); // Small values as numbers
    });
});

// ============================================================================
// Float Scalar Tests
// ============================================================================

describe('FloatScalar', () => {
    it('validates float values', () => {
        expect(FloatScalar.validate(3.14)).toEqual({ valid: true, value: 3.14 });
        expect(FloatScalar.validate(42)).toEqual({ valid: true, value: 42 });
        expect(FloatScalar.validate(-0.5)).toEqual({ valid: true, value: -0.5 });
    });

    it('rejects non-finite values', () => {
        expect(FloatScalar.validate(Infinity).valid).toBe(false);
        expect(FloatScalar.validate(NaN).valid).toBe(false);
    });

    it('validates range constraints', () => {
        expect(FloatScalar.validate(3.14, { min: 0, max: 10 })).toEqual({ valid: true, value: 3.14 });
        expect(FloatScalar.validate(-1, { min: 0 }).valid).toBe(false);
    });

    it('applies scale rounding', () => {
        const result = FloatScalar.validate(3.14159, { scale: 2 });
        expect(result.valid).toBe(true);
        expect(result.value).toBe(3.14);
    });
});

// ============================================================================
// Boolean Scalar Tests
// ============================================================================

describe('BooleanScalar', () => {
    it('validates boolean values', () => {
        expect(BooleanScalar.validate(true)).toEqual({ valid: true, value: true });
        expect(BooleanScalar.validate(false)).toEqual({ valid: true, value: false });
    });

    it('coerces string truthy values', () => {
        expect(BooleanScalar.validate('true', { coerce: true })).toEqual({ valid: true, value: true });
        expect(BooleanScalar.validate('yes', { coerce: true })).toEqual({ valid: true, value: true });
        expect(BooleanScalar.validate('1', { coerce: true })).toEqual({ valid: true, value: true });
        expect(BooleanScalar.validate('on', { coerce: true })).toEqual({ valid: true, value: true });
    });

    it('coerces string falsy values', () => {
        expect(BooleanScalar.validate('false', { coerce: true })).toEqual({ valid: true, value: false });
        expect(BooleanScalar.validate('no', { coerce: true })).toEqual({ valid: true, value: false });
        expect(BooleanScalar.validate('0', { coerce: true })).toEqual({ valid: true, value: false });
        expect(BooleanScalar.validate('off', { coerce: true })).toEqual({ valid: true, value: false });
    });

    it('coerces numbers', () => {
        expect(BooleanScalar.validate(1, { coerce: true })).toEqual({ valid: true, value: true });
        expect(BooleanScalar.validate(0, { coerce: true })).toEqual({ valid: true, value: false });
    });
});

// ============================================================================
// UUID Scalar Tests
// ============================================================================

describe('UuidScalar', () => {
    it('validates UUID v4 format', () => {
        const validUuid = '123e4567-e89b-42d3-a456-426614174000';
        expect(UuidScalar.validate(validUuid).valid).toBe(true);
        expect(UuidScalar.validate('invalid-uuid').valid).toBe(false);
        expect(UuidScalar.validate('12345').valid).toBe(false);
    });

    it('normalizes to lowercase', () => {
        const uuid = '123E4567-E89B-42D3-A456-426614174000';
        const result = UuidScalar.validate(uuid);
        expect(result.valid).toBe(true);
        expect(result.value).toBe('123e4567-e89b-42d3-a456-426614174000');
    });

    it('generates default UUID', () => {
        const uuid = UuidScalar.generateDefault!();
        expect(typeof uuid).toBe('string');
        expect(UuidScalar.validate(uuid).valid).toBe(true);
    });
});

// ============================================================================
// Timestamp Scalar Tests
// ============================================================================

describe('TimestampScalar', () => {
    it('validates ISO 8601 timestamps', () => {
        const ts = '2025-12-16T10:00:00Z';
        expect(TimestampScalar.validate(ts).valid).toBe(true);
    });

    it('validates Date objects', () => {
        const date = new Date('2025-12-16T10:00:00Z');
        const result = TimestampScalar.validate(date);
        expect(result.valid).toBe(true);
        expect(typeof result.value).toBe('string');
    });

    it('rejects invalid timestamps', () => {
        expect(TimestampScalar.validate('invalid-date').valid).toBe(false);
    });

    it('coerces numbers (epoch)', () => {
        const epoch = Date.now();
        const result = TimestampScalar.validate(epoch, { coerce: true });
        expect(result.valid).toBe(true);
    });

    it('generates current timestamp', () => {
        const ts = TimestampScalar.generateDefault!();
        expect(TimestampScalar.validate(ts).valid).toBe(true);
    });
});

// ============================================================================
// Date Scalar Tests
// ============================================================================

describe('DateScalar', () => {
    it('validates ISO date format (YYYY-MM-DD)', () => {
        expect(DateScalar.validate('2025-12-16')).toEqual({ valid: true, value: '2025-12-16' });
        expect(DateScalar.validate('2025-1-1').valid).toBe(false); // Needs zero-padding
    });

    it('extracts date from datetime', () => {
        const result = DateScalar.validate('2025-12-16T10:00:00Z');
        expect(result.valid).toBe(true);
        expect(result.value).toBe('2025-12-16');
    });

    it('validates Date objects', () => {
        const date = new Date('2025-12-16');
        const result = DateScalar.validate(date);
        expect(result.valid).toBe(true);
        expect(result.value).toBe('2025-12-16');
    });
});

// ============================================================================
// Time Scalar Tests
// ============================================================================

describe('TimeScalar', () => {
    it('validates HH:MM:SS format', () => {
        expect(TimeScalar.validate('10:30:00')).toEqual({ valid: true, value: '10:30:00' });
        expect(TimeScalar.validate('23:59:59')).toEqual({ valid: true, value: '23:59:59' });
    });

    it('accepts HH:MM format and normalizes', () => {
        const result = TimeScalar.validate('10:30');
        expect(result.valid).toBe(true);
        expect(result.value).toBe('10:30:00');
    });

    it('rejects invalid times', () => {
        expect(TimeScalar.validate('25:00:00').valid).toBe(false);
        expect(TimeScalar.validate('10:60:00').valid).toBe(false);
        expect(TimeScalar.validate('invalid').valid).toBe(false);
    });
});

// ============================================================================
// JSON Scalar Tests
// ============================================================================

describe('JsonScalar', () => {
    it('validates objects', () => {
        const obj = { key: 'value', nested: { a: 1 } };
        expect(JsonScalar.validate(obj)).toEqual({ valid: true, value: obj });
    });

    it('validates arrays', () => {
        const arr = [1, 2, 3];
        expect(JsonScalar.validate(arr)).toEqual({ valid: true, value: arr });
    });

    it('parses JSON strings', () => {
        const result = JsonScalar.validate('{"key": "value"}');
        expect(result.valid).toBe(true);
        expect(result.value).toEqual({ key: 'value' });
    });

    it('rejects invalid JSON strings', () => {
        expect(JsonScalar.validate('{invalid}').valid).toBe(false);
    });

    it('accepts primitives as valid JSON', () => {
        expect(JsonScalar.validate(42)).toEqual({ valid: true, value: 42 });
        expect(JsonScalar.validate(true)).toEqual({ valid: true, value: true });
    });
});

// ============================================================================
// Binary Scalar Tests
// ============================================================================

describe('BinaryScalar', () => {
    it('validates Uint8Array', () => {
        const bytes = new Uint8Array([1, 2, 3, 4]);
        expect(BinaryScalar.validate(bytes).valid).toBe(true);
    });

    it('validates base64 strings', () => {
        const base64 = 'SGVsbG8gV29ybGQ='; // "Hello World"
        expect(BinaryScalar.validate(base64).valid).toBe(true);
    });

    it('validates size constraints', () => {
        const bytes = new Uint8Array(100);
        expect(BinaryScalar.validate(bytes, { max: 50 }).valid).toBe(false);
        expect(BinaryScalar.validate(bytes, { min: 50, max: 200 }).valid).toBe(true);
    });
});

// ============================================================================
// ID Scalar Tests
// ============================================================================

describe('IdScalar', () => {
    it('validates like UUID', () => {
        const validId = '123e4567-e89b-42d3-a456-426614174000';
        expect(IdScalar.validate(validId).valid).toBe(true);
    });

    it('generates UUID as default', () => {
        const id = IdScalar.generateDefault!();
        expect(UuidScalar.validate(id).valid).toBe(true);
    });

    it('can be primary key', () => {
        expect(IdScalar.canBePrimaryKey).toBe(true);
    });
});

// ============================================================================
// Scalar Registry Tests
// ============================================================================

describe('ScalarRegistry', () => {
    it('has all core scalars registered', () => {
        expect(isScalarType('string')).toBe(true);
        expect(isScalarType('text')).toBe(true);
        expect(isScalarType('int')).toBe(true);
        expect(isScalarType('bigint')).toBe(true);
        expect(isScalarType('float')).toBe(true);
        expect(isScalarType('boolean')).toBe(true);
        expect(isScalarType('uuid')).toBe(true);
        expect(isScalarType('timestamp')).toBe(true);
        expect(isScalarType('date')).toBe(true);
        expect(isScalarType('time')).toBe(true);
        expect(isScalarType('json')).toBe(true);
        expect(isScalarType('binary')).toBe(true);
        expect(isScalarType('id')).toBe(true);
    });

    it('identifies core scalar types', () => {
        expect(isCoreScalarType('string')).toBe(true);
        expect(isCoreScalarType('int')).toBe(true);
        expect(isCoreScalarType('NotAScalar')).toBe(false);
    });

    it('validates through registry', () => {
        expect(validateScalar('string', 'hello').valid).toBe(true);
        expect(validateScalar('int', 42).valid).toBe(true);
        expect(validateScalar('unknown', 'value').valid).toBe(false);
    });

    it('allows registering custom scalars', () => {
        const customScalar: ScalarTypeDefinition = {
            name: 'postalCode',
            description: 'Postal code',
            tsType: 'string',
            dbTypeHint: 'VARCHAR(10)',
            source: 'test-plugin',
            validate(value) {
                if (typeof value !== 'string') {
                    return { valid: false, error: 'Expected string' };
                }
                if (!/^\d{5}(-\d{4})?$/.test(value)) {
                    return { valid: false, error: 'Invalid postal code' };
                }
                return { valid: true, value };
            },
        };

        registerScalar(customScalar);

        expect(isScalarType('postalCode')).toBe(true);
        expect(validateScalar('postalCode', '12345').valid).toBe(true);
        expect(validateScalar('postalCode', '12345-6789').valid).toBe(true);
        expect(validateScalar('postalCode', 'invalid').valid).toBe(false);
    });
});

// ============================================================================
// Relation Detection Tests
// ============================================================================

describe('Relation Type Detection', () => {
    describe('isRelationTypeName', () => {
        it('detects PascalCase model names', () => {
            expect(isRelationTypeName('User')).toBe(true);
            expect(isRelationTypeName('BlogPost')).toBe(true);
            expect(isRelationTypeName('APIKey')).toBe(true);
        });

        it('rejects non-PascalCase names', () => {
            expect(isRelationTypeName('user')).toBe(false);
            expect(isRelationTypeName('blogPost')).toBe(false);
            expect(isRelationTypeName('string')).toBe(false);
        });
    });

    describe('extractBaseName', () => {
        it('removes array brackets', () => {
            expect(extractBaseName('Post[]')).toBe('Post');
            expect(extractBaseName('string[]')).toBe('string');
        });

        it('removes modifiers', () => {
            expect(extractBaseName('User!')).toBe('User');
            expect(extractBaseName('User?')).toBe('User');
            expect(extractBaseName('Post[]!')).toBe('Post');
        });
    });

    describe('isArrayType', () => {
        it('detects array types', () => {
            expect(isArrayType('string[]')).toBe(true);
            expect(isArrayType('Post[]')).toBe(true);
            expect(isArrayType('string')).toBe(false);
        });
    });

    describe('isRequiredType', () => {
        it('detects required types', () => {
            expect(isRequiredType('string!')).toBe(true);
            expect(isRequiredType('User!')).toBe(true);
            expect(isRequiredType('string')).toBe(false);
            expect(isRequiredType('User?')).toBe(false);
        });
    });

    describe('isRelationType', () => {
        it('detects relations (PascalCase, not scalar)', () => {
            expect(isRelationType('User')).toBe(true);
            expect(isRelationType('Post!')).toBe(true);
            expect(isRelationType('Tag[]')).toBe(true);
        });

        it('excludes scalar types', () => {
            expect(isRelationType('string')).toBe(false);
            expect(isRelationType('int')).toBe(false);
            expect(isRelationType('uuid')).toBe(false);
        });

        it('respects known models set', () => {
            const models = new Set(['User', 'Post']);
            expect(isRelationType('User', models)).toBe(true);
            expect(isRelationType('Unknown', models)).toBe(true); // Still PascalCase
        });
    });

    describe('classifyType', () => {
        it('classifies scalar types', () => {
            const result = classifyType('string!');
            expect(result.category).toBe('scalar');
            expect(result.baseName).toBe('string');
            expect(result.required).toBe(true);
        });

        it('classifies array scalar types', () => {
            const result = classifyType('string[]');
            expect(result.category).toBe('array');
            expect(result.baseName).toBe('string');
            expect(result.isArray).toBe(true);
        });

        it('classifies relation types', () => {
            const result = classifyType('User!');
            expect(result.category).toBe('relation');
            expect(result.baseName).toBe('User');
            expect(result.required).toBe(true);
            expect(result.relation).toBeDefined();
        });

        it('classifies enum types', () => {
            const result = classifyType('enum(draft, published)');
            expect(result.category).toBe('enum');
            expect(result.enumValues).toEqual(['draft', 'published']);
        });
    });

    describe('parseRelationType', () => {
        it('parses simple relation', () => {
            const result = parseRelationType('User');
            expect(result.target).toBe('User');
            expect(result.isArray).toBe(false);
            expect(result.required).toBe(false);
            expect(result.kind).toBe('belongs-to');
        });

        it('parses required relation', () => {
            const result = parseRelationType('User!');
            expect(result.required).toBe(true);
        });

        it('parses array relation', () => {
            const result = parseRelationType('Post[]');
            expect(result.isArray).toBe(true);
            expect(result.kind).toBe('has-many');
        });

        it('parses through table', () => {
            const result = parseRelationType('Tag[] through:post_tags');
            expect(result.through).toBe('post_tags');
            expect(result.kind).toBe('many-to-many');
        });

        it('parses cascade options', () => {
            const result = parseRelationType('Post[] cascade');
            expect(result.onDelete).toBe('cascade');
            expect(result.onUpdate).toBe('cascade');
        });

        it('parses foreign key override', () => {
            const result = parseRelationType('User foreignKey:author_id');
            expect(result.foreignKey).toBe('author_id');
        });
    });
});

// ============================================================================
// TypeParser Integration Tests
// ============================================================================

describe('TypeParser', () => {
    it('parses core scalar types', () => {
        expect(TypeParser.parse('string').type).toBe('string');
        expect(TypeParser.parse('int').type).toBe('int');
        expect(TypeParser.parse('uuid').type).toBe('uuid');
        expect(TypeParser.parse('timestamp').type).toBe('timestamp');
    });

    it('parses required modifier', () => {
        const result = TypeParser.parse('string!');
        expect(result.nullable).toBe(false);
    });

    it('parses optional modifier', () => {
        const result = TypeParser.parse('string?');
        expect(result.nullable).toBe(true);
    });

    it('parses array types', () => {
        const result = TypeParser.parse('string[]');
        expect(result.array).toBe(true);
    });

    it('parses default values', () => {
        const result = TypeParser.parse("string = 'hello'");
        expect(result.default).toBe('hello');
    });

    it('parses default functions', () => {
        const result = TypeParser.parse('timestamp = now');
        expect(result.defaultFn).toBe('now');
    });

    it('parses enum values', () => {
        const result = TypeParser.parse('enum(draft, published, archived)');
        expect(result.enumValues).toEqual(['draft', 'published', 'archived']);
    });

    it('parses string length', () => {
        const result = TypeParser.parse('string(100)');
        expect(result.length).toBe(100);
        expect(result.maxLength).toBe(100);
    });

    it('parses string length range', () => {
        const result = TypeParser.parse('string(3..50)');
        expect(result.minLength).toBe(3);
        expect(result.maxLength).toBe(50);
    });

    it('parses int range', () => {
        const result = TypeParser.parse('int(0..100)');
        expect(result.min).toBe(0);
        expect(result.max).toBe(100);
    });

    it('parses decimal precision/scale', () => {
        const result = TypeParser.parse('decimal(10, 2)');
        expect(result.precision).toBe(10);
        expect(result.scale).toBe(2);
    });
});
