# Yama Type System v1.0

## Overview

The Yama type system provides a comprehensive, schema-first approach to field type definitions with:

- **12 core scalar types** (v1.0)
- **Runtime validation** for all types
- **Relation type detection** for model references
- **Plugin extensibility** for custom scalars
- **Database mapping** (PostgreSQL, MySQL, SQLite)

## Core Scalar Types (v1.0)

| Type        | YAML Syntax      | Description                          | TypeScript Type         |
|-------------|------------------|--------------------------------------|-------------------------|
| `string`    | `string`         | UTF-8 string (default max 255 chars) | `string`               |
| `text`      | `text`           | Long text (no length limit)          | `string`               |
| `int`       | `int`            | 32-bit signed integer                | `number`               |
| `bigint`    | `bigint`         | 64-bit integer                       | `bigint \| number`     |
| `float`     | `float`          | 64-bit floating point                | `number`               |
| `boolean`   | `boolean`        | true/false value                     | `boolean`              |
| `uuid`      | `uuid`           | UUID v4 (auto-generated if primary)  | `string`               |
| `timestamp` | `timestamp`      | ISO 8601 datetime with timezone      | `string \| Date`       |
| `date`      | `date`           | ISO 8601 date only (YYYY-MM-DD)      | `string`               |
| `time`      | `time`           | ISO 8601 time only (HH:MM:SS)        | `string`               |
| `json`      | `json`           | Arbitrary JSON object/array          | `Record<string, unknown>` |
| `binary`    | `binary`         | Raw bytes (Buffer/base64)            | `Buffer \| Uint8Array` |

### Special Type: `id`

The `id` type is a shortcut for `uuid` as a primary key with auto-generation:

```yaml
schemas:
  User:
    fields:
      id: id  # Auto-generates uuid primary key
```

## Type Modifiers

| Modifier | Syntax | Description |
|----------|--------|-------------|
| Required | `!`    | Field cannot be null |
| Optional | `?`    | Field can be null (default) |
| Array    | `[]`   | Array of the type |

### Examples

```yaml
name: string!          # Required string
bio: text?             # Optional text
age: int               # Integer (nullable by default)
tags: string[]         # Array of strings
posts: Post[]          # Array relation (has-many)
author: User!          # Required relation (belongs-to)
```

## Type Parameters

### String Constraints

```yaml
name: string(100)           # Max 100 characters
username: string(3..30)     # Between 3 and 30 characters
slug: string(/^[a-z-]+$/)   # Regex pattern
```

### Numeric Constraints

```yaml
age: int(0..150)            # Between 0 and 150
price: float(min: 0)        # Minimum 0
quantity: int(max: 1000)    # Maximum 1000
```

### Decimal Precision

```yaml
amount: decimal(10, 2)      # precision: 10, scale: 2
```

### Enum Values

```yaml
status: enum(draft, published, archived)
role: string = "user" @enum(["user", "admin"])
```

## Default Values

```yaml
isActive: boolean = true          # Static default
status: string = "draft"          # String default
count: int = 0                    # Numeric default
createdAt: timestamp = now        # Function default
id: uuid = uuid()                 # UUID generator
metadata: json = {}               # Empty object
```

## Relation Types

Relations are detected automatically by PascalCase naming:

```yaml
schemas:
  Post:
    fields:
      author: User!                    # Required belongs-to
      category: Category               # Optional belongs-to
      tags: Tag[]                      # Has-many
      coAuthors: User[] through:post_authors  # Many-to-many
```

### Relation Modifiers

```yaml
posts: Post[] cascade              # Cascade delete
author: User! foreignKey:author_id # Custom foreign key
tag: Tag ref:tag_id                # Custom referenced field
```

## Runtime Validation

All scalar types include runtime validators:

```typescript
import { validateScalar, StringScalar, IntScalar } from '@yamajs/core';

// Via registry
const result = validateScalar('string', 'hello');
// { valid: true, value: 'hello' }

// With options
validateScalar('string', 'hi', { minLength: 3 });
// { valid: false, error: 'String must be at least 3 characters' }

// Direct validator
IntScalar.validate(42, { min: 0, max: 100 });
// { valid: true, value: 42 }

// With coercion
StringScalar.validate(123, { coerce: true });
// { valid: true, value: '123' }
```

### Validation Options

```typescript
interface ScalarValidateOptions {
  nullable?: boolean;     // Allow null (default: true)
  coerce?: boolean;       // Coerce compatible types
  min?: number;           // Minimum value/length
  max?: number;           // Maximum value/length
  minLength?: number;     // Min string length
  maxLength?: number;     // Max string length
  pattern?: string;       // Regex pattern
  enumValues?: string[];  // Allowed enum values
  precision?: number;     // Decimal precision
  scale?: number;         // Decimal scale
}
```

## Plugin Extensibility

Register custom scalar types via plugins:

```typescript
import { registerScalar, ScalarTypeDefinition } from '@yamajs/core';

const EmailScalar: ScalarTypeDefinition = {
  name: 'email',
  description: 'Email address',
  tsType: 'string',
  dbTypeHint: 'VARCHAR(255)',
  source: 'my-plugin',
  
  validate(value, options) {
    if (typeof value !== 'string') {
      return { valid: false, error: 'Expected string' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      return { valid: false, error: 'Invalid email format' };
    }
    return { valid: true, value: value.toLowerCase() };
  },
  
  parse(value) {
    return value.toLowerCase();
  },
};

registerScalar(EmailScalar);

// Now usable in schemas:
// email: email!
```

## Type Classification

Classify types programmatically:

```typescript
import { classifyType, isRelationType, isScalarType } from '@yamajs/core';

classifyType('string!');
// { category: 'scalar', baseName: 'string', required: true, isArray: false }

classifyType('User!');
// { 
//   category: 'relation',
//   baseName: 'User',
//   required: true,
//   relation: { target: 'User', kind: 'belongs-to', ... }
// }

classifyType('Post[]');
// { 
//   category: 'relation',
//   isArray: true,
//   relation: { target: 'Post', kind: 'has-many', ... }
// }

isScalarType('string');  // true
isScalarType('User');    // false
isRelationType('User');  // true
isRelationType('string'); // false
```

## Database Type Mapping

The `DatabaseTypeMapper` converts field types to SQL:

```typescript
import { DatabaseTypeMapper, TypeParser } from '@yamajs/core';

const fieldType = TypeParser.parse('string(100)');

DatabaseTypeMapper.toPostgreSQL(fieldType);  // 'VARCHAR(100)'
DatabaseTypeMapper.toMySQL(fieldType);       // 'VARCHAR(100)'
DatabaseTypeMapper.toSQLite(fieldType);      // 'TEXT'

TypeParser.parse('uuid');
// PostgreSQL: 'UUID'
// MySQL: 'CHAR(36)'
// SQLite: 'TEXT'

TypeParser.parse('json');
// PostgreSQL: 'JSONB'
// MySQL: 'JSON'
// SQLite: 'TEXT'
```

## Full Schema Example

```yaml
schemas:
  User:
    fields:
      id: id                                  # Auto uuid primary key
      email: string! @unique @email           # Required, unique, email format
      name: string?                           # Optional
      age: int(0..150)                        # Integer with range
      balance: float                          # Floating point
      score: bigint                           # Large integer
      isActive: boolean = true                # Default true
      bio: text?                              # Long text
      metadata: json = {}                     # JSON object
      createdAt: timestamp = now              # Auto timestamp
      birthDate: date?                        # Date only
      wakeUpTime: time?                       # Time only
      avatar: binary                          # Binary data
      tags: string[]                          # String array
      role: string = "user" @enum(["user", "admin"])
      posts: Post[]                           # Has-many relation
      bestPost: Post?                         # Optional relation
      team: Team!                             # Required relation
```

## Files

- `types/scalars.ts` - Core scalar type definitions and validators
- `types/relations.ts` - Relation type detection and parsing
- `types/types.ts` - Type definitions (CoreScalarType, ExtendedType, FieldType)
- `types/parser.ts` - YAML type string parser
- `types/mapper.ts` - Database type mapping
- `types/validator.ts` - SQL CHECK constraint generation
- `types/index.ts` - Exported API
