# YAMA Type System - Complete Reference

A comprehensive guide to the schema-first type system in YAMA.

---

## Design Philosophy

**Schema = Type + Validation + Metadata (all-in-one)**

- **One mental model**: Everything is a schema, types are extracted
- **Unified**: DTOs and entities are the same concept
- **Variants**: Auto-generate API schemas (create, update, response)
- **Runtime + compile-time safety**: Validation built-in, types inferred
- **Future-proof**: Easy to create variants with pick, omit, partial
- **Robust**: Single source of truth, transformable, composable

---

## Quick Start

### Before (Old Syntax)

```yaml
entities:
  User:
    fields:
      email: string? format: email    # Ambiguous!
      price: string format: decimal   # No precision
      publishedAt: string? format: date-time  # What timezone?
```

### After (New Syntax)

```yaml
schemas:
  User:
    id: uuid! readonly generated
    email: email(255)! unique
    username: slug(3..100)! unique
    price: money(usd, min: 0)!
    publishedAt: timestamp?
    createdAt: timestamp readonly = now()
```

---

## Field Syntax

YAMA supports two syntax styles that can be mixed per-field:

### Concise Inline Syntax (Recommended)

```yaml
fieldName: type(params) modifiers = default
```

**Examples:**

```yaml
# Basic types
id: uuid!                              # Required UUID
name: string!                          # Required string (VARCHAR 255)
bio: text?                             # Optional text (unlimited)

# With parameters
email: email(255)!                     # Email, max 255 chars
username: slug(3..100)!                # Slug, 3-100 chars
price: decimal(10, 2)!                 # Decimal, precision 10, scale 2

# With modifiers
email: email! unique indexed           # Unique + indexed
password: string(60)! sensitive writeOnly

# With defaults
role: enum(user, admin) = user
isActive: boolean = true
createdAt: timestamp = now()
```

### Expanded Syntax (For Complex Fields)

```yaml
fieldName:
  type: typeName
  # ... additional properties
```

**Examples:**

```yaml
email:
  type: email
  maxLength: 255
  unique: true
  indexed: true
  description: "User's primary email address"

metadata:
  type: json
  description: "Arbitrary metadata"
  default: {}
```

---

## Type Reference

### String Types

| Type | Database (PostgreSQL) | Description | Example |
|------|----------------------|-------------|---------|
| `string` | VARCHAR(255) | Variable-length string | `name: string` |
| `string(n)` | VARCHAR(n) | String with max length | `code: string(10)` |
| `string(min..max)` | VARCHAR(max) + CHECK | String with length range | `username: string(3..50)` |
| `text` | TEXT | Unlimited text | `content: text` |
| `text(max)` | TEXT + CHECK | Text with max length | `bio: text(5000)` |
| `email` | VARCHAR(255) + CHECK | Email validation | `email: email!` |
| `email(n)` | VARCHAR(n) + CHECK | Email with max length | `email: email(100)` |
| `url` | VARCHAR(2048) + CHECK | URL validation | `website: url?` |
| `url(n)` | VARCHAR(n) + CHECK | URL with max length | `link: url(500)` |
| `phone` | VARCHAR(20) + CHECK | E.164 phone format | `phone: phone?` |
| `slug` | VARCHAR(255) + CHECK | URL-safe slug pattern | `slug: slug!` |
| `slug(n)` | VARCHAR(n) + CHECK | Slug with max length | `slug: slug(100)` |
| `slug(min..max)` | VARCHAR(max) + CHECK | Slug with length range | `slug: slug(3..100)` |
| `uuid` | UUID | UUID identifier | `id: uuid!` |

**String Type Examples:**

```yaml
schemas:
  User:
    # Basic strings
    firstName: string!                   # VARCHAR(255), required
    middleName: string?                  # VARCHAR(255), optional
    
    # Length constraints
    username: string(3..30)!             # VARCHAR(30), min 3 chars
    bio: text(5000)?                     # TEXT, max 5000 chars
    
    # Specialized strings
    email: email! unique                 # Email validation
    website: url?                        # URL validation
    phone: phone?                        # E.164 format
    profileSlug: slug(3..100)! unique    # URL-safe slug
    
    # UUID
    id: uuid! readonly generated         # Auto-generated UUID
    referralCode: uuid?                  # Optional UUID reference
```

---

### Numeric Types

| Type | Database (PostgreSQL) | Range | Example |
|------|----------------------|-------|---------|
| `int` | INTEGER | -2.1B to 2.1B | `age: int` |
| `int8` | SMALLINT | -128 to 127 | `priority: int8` |
| `int16` | SMALLINT | -32K to 32K | `year: int16` |
| `int32` | INTEGER | -2.1B to 2.1B | `count: int32` |
| `int64` | BIGINT | Very large | `bigNumber: int64` |
| `bigint` | BIGINT | Alias for int64 | `hugeNumber: bigint` |
| `uint` | INTEGER + CHECK | 0 to 2.1B | `viewCount: uint` |
| `decimal(p, s)` | DECIMAL(p, s) | Exact precision | `price: decimal(10, 2)` |
| `float` | REAL | 32-bit float | `latitude: float` |
| `double` | DOUBLE PRECISION | 64-bit float | `precise: double` |

**Numeric Constraints:**

```yaml
# Range constraints
age: int(0..120)                        # Between 0 and 120
rating: decimal(3, 2, 0..5)             # 0.00 to 5.00
score: int(min: 0)                      # Minimum only
level: int(max: 100)                    # Maximum only

# Unsigned (shorthand for min: 0)
viewCount: uint                         # INTEGER >= 0
likeCount: uint = 0                     # With default
```

**Numeric Type Examples:**

```yaml
schemas:
  Product:
    # Basic integers
    stock: int! = 0                      # INTEGER, default 0
    viewCount: uint = 0                  # Unsigned, default 0
    
    # Sized integers
    priority: int8                       # Small integer (-128 to 127)
    year: int16                          # Year values
    
    # Range constraints
    rating: int(1..5)!                   # Rating 1-5
    percentage: int(0..100)!             # Percentage
    
    # Decimals with precision
    price: decimal(10, 2)!               # $99999999.99
    weight: decimal(8, 3)?               # 99999.999 kg
    
    # Floating point (use sparingly)
    latitude: float?                     # 32-bit
    longitude: float?                    # 32-bit
```

---

### Money Type

Money type provides currency-aware decimal handling with appropriate precision.

| Type | Database | Default Precision | Example |
|------|----------|-------------------|---------|
| `money` | DECIMAL(19, 4) | 19, 4 | `amount: money` |
| `money(currency)` | DECIMAL(19, 4) | 19, 4 | `price: money(usd)` |
| `money(currency, constraints)` | DECIMAL(19, 4) + CHECK | 19, 4 | `price: money(usd, min: 0)` |

**Currency codes:** USD, EUR, GBP, JPY, etc. (ISO 4217)

**Note:** JPY and other zero-decimal currencies automatically use scale 0.

**Money Examples:**

```yaml
schemas:
  Product:
    # Basic money
    price: money!                        # Generic money
    cost: money?                         # Optional
    
    # Currency-specific
    priceUsd: money(usd)!               # USD
    priceEur: money(eur)?               # EUR
    priceJpy: money(jpy)?               # JPY (no decimals)
    
    # With constraints
    listPrice: money(usd, min: 0)!      # Non-negative
    discount: money(usd, 0..1000)       # Limited range
    
  Order:
    subtotal: money(usd, min: 0)!
    tax: money(usd, min: 0)!
    shipping: money(usd, min: 0)!
    total: money(usd, min: 0)!
```

---

### Boolean Type

| Type | Database | Example |
|------|----------|---------|
| `boolean` | BOOLEAN | `isActive: boolean` |

**Boolean Examples:**

```yaml
schemas:
  User:
    isActive: boolean = true            # Default true
    isVerified: boolean = false         # Default false
    isAdmin: boolean!                   # Required, no default
    
    # Nullable boolean (tri-state: true/false/null)
    emailVerified: boolean?             # null = unknown/pending
```

---

### Date & Time Types

| Type | Database (PostgreSQL) | Description | Example |
|------|----------------------|-------------|---------|
| `date` | DATE | Date only (no time) | `birthDate: date` |
| `time` | TIME | Time only (no date) | `startTime: time` |
| `timestamp` | TIMESTAMPTZ | UTC timestamp (recommended) | `createdAt: timestamp` |
| `timestamptz` | TIMESTAMPTZ | Explicit timezone-aware | `scheduledAt: timestamptz` |
| `timestamplocal` | TIMESTAMP | No timezone (use carefully) | `localTime: timestamplocal` |
| `datetime` | TIMESTAMPTZ | Alias for timestamp | `occurredAt: datetime` |
| `datetimetz` | TIMESTAMPTZ | Alias for timestamptz | `eventAt: datetimetz` |
| `datetimelocal` | TIMESTAMP | Alias for timestamplocal | `meetingAt: datetimelocal` |
| `interval` | INTERVAL | Duration/interval | `duration: interval` |
| `duration` | INTERVAL | Alias for interval | `timeout: duration` |

**Date/Time Constraints:**

```yaml
# Date ranges
birthDate: date(..2010-01-01)           # Past dates only (before 2010)
eventDate: date(2024-01-01..)           # Future dates only (after 2024)
validDate: date(2024-01-01..2025-12-31) # Date range

# Timestamp constraints
scheduledAt: timestamp(+1h..)           # At least 1 hour in future
deadline: timestamp(..+30d)             # Within next 30 days
```

**Date/Time Examples:**

```yaml
schemas:
  Event:
    # Date only
    startDate: date!
    endDate: date!
    
    # Time only
    startTime: time!
    endTime: time?
    
    # Timestamps (always use UTC)
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
    publishedAt: timestamp?
    
    # Duration
    duration: interval?
    
  User:
    birthDate: date?
    lastLoginAt: timestamp?
    deletedAt: timestamp?               # Soft delete
```

---

### JSON Types

| Type | Database (PostgreSQL) | Description | Example |
|------|----------------------|-------------|---------|
| `json` | JSONB | JSON data (binary) | `metadata: json` |
| `jsonb` | JSONB | Explicit JSONB | `data: jsonb` |

**JSON Examples:**

```yaml
schemas:
  Product:
    metadata: json?                      # Optional JSON
    specifications: json = {}            # Default empty object
    
    # With description
    customFields:
      type: json
      description: "User-defined fields"
      default: {}
```

---

### Binary Types

| Type | Database (PostgreSQL) | Description | Example |
|------|----------------------|-------------|---------|
| `binary` | BYTEA | Binary data | `avatar: binary` |
| `binary(size)` | BYTEA + CHECK | With size limit | `thumbnail: binary(100kb)` |
| `binary(min..max)` | BYTEA + CHECK | Size range | `file: binary(1kb..10mb)` |
| `base64` | TEXT + CHECK | Base64 encoded | `icon: base64` |
| `base64(size)` | TEXT + CHECK | With size limit | `image: base64(1mb)` |

**Size units:** `kb`, `mb`, `gb`

**Binary Examples:**

```yaml
schemas:
  Attachment:
    content: binary!                     # Required binary
    thumbnail: binary(100kb)?            # Max 100KB
    file: binary(1kb..10mb)!            # 1KB to 10MB range
    
    # Base64 encoded
    icon: base64?
    preview: base64(500kb)
```

---

### Enum Type

Enums define a fixed set of allowed values.

**Inline Enum:**

```yaml
status: enum(draft, published, archived)
role: enum(user, admin, moderator) = user
```

**Named Enum (Reusable):**

```yaml
enums:
  PostStatus:
    values: [draft, published, archived]
    default: draft
  
  UserRole:
    values: [user, admin, moderator]
    default: user

schemas:
  Post:
    status: PostStatus! = draft
  
  User:
    role: UserRole! = user
```

**Enum Examples:**

```yaml
schemas:
  Order:
    # Inline enum
    status: enum(pending, processing, shipped, delivered, cancelled) = pending
    paymentStatus: enum(unpaid, paid, refunded)!
    
    # Using named enum
    priority: OrderPriority = normal

enums:
  OrderPriority:
    values: [low, normal, high, urgent]
    default: normal
```

---

### Array Types

Arrays are denoted with `[]` suffix.

| Syntax | Description | Example |
|--------|-------------|---------|
| `type[]` | Array of type | `tags: string[]` |
| `type[]?` | Optional array | `categories: string[]?` |
| `type[](max: n)` | Max items | `tags: string[](max: 10)` |
| `type[](min..max)` | Item count range | `scores: int[](1..5)` |

**Array Examples:**

```yaml
schemas:
  Post:
    # Basic arrays
    tags: string[]                       # Array of strings
    scores: int[]?                       # Optional array
    
    # With constraints
    categories: string[](max: 5)         # Max 5 items
    ratings: int[](1..10)                # 1-10 ratings
    
    # Array of validated types
    emails: email[]                      # Array of emails
    images: url[]                        # Array of URLs
```

---

## Field Modifiers

Modifiers change field behavior without affecting the type.

| Modifier | Description | Example |
|----------|-------------|---------|
| `!` | Required (NOT NULL) | `email: string!` |
| `?` | Optional (nullable) | `bio: string?` |
| `unique` | Unique constraint | `email: email! unique` |
| `indexed` | Create index | `slug: string! indexed` |
| `readonly` | Cannot be updated | `createdAt: timestamp readonly` |
| `writeOnly` | Not in responses | `password: string! writeOnly` |
| `sensitive` | Excluded from logs/responses | `ssn: string! sensitive` |
| `generated` | Auto-generated value | `id: uuid! generated` |
| `autoUpdate` | Auto-update on changes | `updatedAt: timestamp autoUpdate` |

**Modifier Combinations:**

```yaml
schemas:
  User:
    # Identity
    id: uuid! readonly generated
    
    # Unique fields
    email: email! unique indexed
    username: slug(3..30)! unique indexed
    
    # Sensitive data
    password: string(60)! sensitive writeOnly
    ssn: string(11)? sensitive
    
    # Timestamps
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
```

---

## Default Values

### Static Defaults

```yaml
isActive: boolean = true
status: string = "pending"
viewCount: int = 0
role: enum(user, admin) = user
tags: string[] = []
metadata: json = {}
```

### Dynamic Defaults

```yaml
# Current timestamp
createdAt: timestamp = now()
updatedAt: timestamp = now()

# Current date/time
registeredDate: date = today()
loginTime: time = current_time()

# Auto-generated
id: uuid = gen_uuid()
token: string = gen_random(32)
slug: slug = gen_slug(title)

# Computed
fullName: string = concat(firstName, ' ', lastName)
```

---

## Computed Fields

Computed fields are derived from other fields and calculated on-the-fly.

```yaml
schemas:
  User:
    firstName: string!
    lastName: string!
    
    computed:
      fullName: string = concat(firstName, ' ', lastName)
      initials: string = concat(substr(firstName, 1, 1), substr(lastName, 1, 1))
  
  Product:
    price: money(usd)!
    taxRate: decimal(4, 2) = 0.08
    
    computed:
      taxAmount: money(usd) = price * taxRate
      totalPrice: money(usd) = price + taxAmount
  
  Order:
    items: OrderItem[]
    
    computed:
      itemCount: int = count(items)
      subtotal: money(usd) = sum(items.price)
```

---

## Variants (Auto-generate DTOs)

Variants automatically generate API-specific schemas from your base schema.

### Per-Schema Variants

```yaml
schemas:
  User:
    id: uuid! readonly generated
    email: email! unique
    username: slug(3..30)! unique
    password: string(60)! sensitive writeOnly
    firstName: string(2..50)!
    lastName: string(2..100)!
    role: enum(user, admin) = user
    isVerified: boolean = false
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
    
    computed:
      fullName: string = concat(firstName, ' ', lastName)
    
    variants:
      # For creating users
      create:
        exclude: [id, createdAt, updatedAt, isVerified]
        override:
          password: string(8..100)!     # Different validation for input
      
      # For updating users
      update:
        exclude: [id, email, createdAt, updatedAt]
        partial: true                    # All fields optional
      
      # For API responses
      response:
        exclude: [password]
        include: [fullName]              # Include computed field
      
      # For login
      login:
        pick: [email, password]
        override:
          password: string(1..100)!     # Accept any password length
      
      # For admin listing
      adminList:
        pick: [id, email, username, role, isVerified, createdAt]
```

### Generated Variants

From the above, YAMA generates:

```typescript
// UserCreate - for POST /users
interface UserCreate {
  email: string;
  username: string;
  password: string;  // 8-100 chars
  firstName: string;
  lastName: string;
  role?: 'user' | 'admin';
}

// UserUpdate - for PATCH /users/:id
interface UserUpdate {
  username?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: 'user' | 'admin';
  isVerified?: boolean;
}

// UserResponse - for API responses
interface UserResponse {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
  fullName: string;  // Computed
}

// UserLogin - for POST /auth/login
interface UserLogin {
  email: string;
  password: string;
}
```

### Global Variant Defaults

Set default rules for all schemas:

```yaml
config:
  variants:
    create:
      autoExclude: [id, createdAt, updatedAt]
    update:
      autoExclude: [id, createdAt]
      partial: true
    response:
      autoExclude: [sensitive, writeOnly]
      autoInclude: [computed]
```

### Variant Operations

| Operation | Description | Example |
|-----------|-------------|---------|
| `exclude` | Remove fields | `exclude: [id, password]` |
| `pick` | Only include these | `pick: [email, password]` |
| `include` | Add computed/hidden | `include: [fullName]` |
| `partial` | All optional | `partial: true` |
| `override` | Change field config | `override: { password: string(8..100) }` |

---

## Reusable Types

Define custom types for reuse across schemas.

```yaml
types:
  # Simple aliases
  Email: email(255)
  Slug: slug(3..100)
  
  # With constraints
  Money: decimal(19, 4, min: 0)
  Percentage: decimal(5, 2, 0..100)
  
  # Complex types
  PhoneNumber: phone
  URL: url(2048)
  
  # Specialized
  SKU: string(3..50)
  PostalCode: string(/^\d{5}(-\d{4})?$/)

schemas:
  User:
    email: Email! unique
    website: URL?
    
  Product:
    sku: SKU! unique
    price: Money!
```

---

## Generic Schemas

Create reusable schema templates with type parameters.

```yaml
schemas:
  # Paginated response wrapper
  PaginatedResponse<T>:
    items: T[]
    total: uint
    page: uint(min: 1)
    pageSize: uint(1..100)
    hasMore: boolean
  
  # API response wrapper
  ApiResponse<T>:
    success: boolean!
    data: T?
    error: string?
    timestamp: timestamp = now()
  
  # Audit wrapper
  Audited<T>:
    data: T!
    createdBy: uuid!
    createdAt: timestamp!
    updatedBy: uuid?
    updatedAt: timestamp?
```

**Usage:**

```yaml
endpoints:
  GET /users:
    response: PaginatedResponse<User.response>
  
  GET /users/:id:
    response: ApiResponse<User.response>
  
  POST /products:
    request: Product.create
    response: ApiResponse<Product.response>
```

---

## Database Configuration

### Table Configuration

```yaml
schemas:
  User:
    # ... fields ...
    
    database:
      table: users                       # Custom table name
      schema: public                     # PostgreSQL schema
```

### Indexes

```yaml
schemas:
  Post:
    title: string!
    authorId: uuid!
    status: enum(draft, published)!
    publishedAt: timestamp?
    
    database:
      indexes:
        # Simple index
        - fields: [title]
        
        # Composite index
        - fields: [authorId, publishedAt]
        
        # Named index
        - name: idx_post_status_date
          fields: [status, publishedAt]
        
        # Unique index
        - fields: [authorId, title]
          unique: true
        
        # Partial index
        - fields: [publishedAt]
          where: { status: published }
        
        # Index type
        - fields: [title, content]
          type: fulltext
        
        - fields: [metadata]
          type: gin
```

### Index Types

| Type | Use Case | Example |
|------|----------|---------|
| `btree` | Default, general purpose | `type: btree` |
| `hash` | Equality comparisons | `type: hash` |
| `gin` | JSON, arrays, full-text | `type: gin` |
| `gist` | Geometric, full-text | `type: gist` |
| `fulltext` | Text search | `type: fulltext` |

---

## Relationships

### Inline Relationship Syntax

```yaml
schemas:
  User:
    id: uuid!
    posts: Post[]                        # hasMany
    profile: Profile?                    # hasOne
  
  Post:
    id: uuid!
    author: User! cascade indexed        # belongsTo
    tags: Tag[] through:post_tags        # manyToMany
  
  Profile:
    id: uuid!
    user: User! cascade                  # belongsTo (one-to-one)
```

### Relationship Modifiers

| Modifier | Description | Example |
|----------|-------------|---------|
| `cascade` | Delete related on parent delete | `author: User! cascade` |
| `setNull` | Set null on parent delete | `reviewer: User? setNull` |
| `restrict` | Prevent parent delete | `category: Category! restrict` |
| `indexed` | Index the foreign key | `author: User! indexed` |
| `through:table` | Many-to-many join table | `tags: Tag[] through:post_tags` |

### Advanced Relationships

```yaml
schemas:
  Post:
    relations:
      author:
        type: belongsTo
        target: User
        foreignKey: authorId
        onDelete: cascade
        onUpdate: cascade
        indexed: true
      
      tags:
        type: manyToMany
        target: Tag
        through: post_tags
        timestamps: true
        fields:
          order: int
          isPrimary: boolean
      
      comments:
        type: hasMany
        target: Comment
        foreignKey: postId
        orderBy: createdAt desc
        where: { deletedAt: null }
```

---

## Validation Rules

### Field-Level Validation

```yaml
schemas:
  User:
    email: email!
    username: string(3..20)!
    age: int?
    website: url?
    
    validation:
      emailFormat:
        field: email
        rule: email
      
      usernamePattern:
        field: username
        rule: regex
        pattern: "^[a-zA-Z0-9_]+$"
        message: "Username can only contain letters, numbers, and underscores"
      
      ageRange:
        field: age
        rule: between
        params: [13, 120]
        message: "Age must be between 13 and 120"
      
      websiteUrl:
        field: website
        rule: url
```

### Entity-Level Validation

```yaml
schemas:
  Event:
    startDate: date!
    endDate: date!
    startTime: time!
    endTime: time?
    
    validation:
      dateOrder:
        rule: custom
        expression: "endDate >= startDate"
        message: "End date must be after or equal to start date"
  
  Product:
    price: money(usd)!
    compareAtPrice: money(usd)?
    
    validation:
      comparePrice:
        rule: custom
        expression: "compareAtPrice IS NULL OR compareAtPrice > price"
        message: "Compare-at price must be greater than regular price"
```

---

## Database Type Mappings

### PostgreSQL

| Schema Type | PostgreSQL Type |
|-------------|-----------------|
| `string` | VARCHAR(255) |
| `string(n)` | VARCHAR(n) |
| `text` | TEXT |
| `email` | VARCHAR(255) |
| `url` | VARCHAR(2048) |
| `phone` | VARCHAR(20) |
| `slug` | VARCHAR(255) |
| `uuid` | UUID |
| `int` | INTEGER |
| `int8` | SMALLINT |
| `int16` | SMALLINT |
| `int32` | INTEGER |
| `int64` | BIGINT |
| `uint` | INTEGER |
| `decimal(p,s)` | DECIMAL(p,s) |
| `money` | DECIMAL(19,4) |
| `float` | REAL |
| `double` | DOUBLE PRECISION |
| `boolean` | BOOLEAN |
| `date` | DATE |
| `time` | TIME |
| `timestamp` | TIMESTAMPTZ |
| `timestamptz` | TIMESTAMPTZ |
| `timestamplocal` | TIMESTAMP |
| `interval` | INTERVAL |
| `json` | JSONB |
| `jsonb` | JSONB |
| `binary` | BYTEA |
| `base64` | TEXT |
| `enum(...)` | Custom ENUM |
| `type[]` | type[] |

### MySQL

| Schema Type | MySQL Type |
|-------------|------------|
| `string` | VARCHAR(255) |
| `text` | TEXT |
| `uuid` | CHAR(36) |
| `int` | INT |
| `int8` | TINYINT |
| `int64` | BIGINT |
| `uint` | INT UNSIGNED |
| `decimal(p,s)` | DECIMAL(p,s) |
| `boolean` | TINYINT(1) |
| `timestamp` | TIMESTAMP |
| `json` | JSON |
| `enum(...)` | ENUM(...) |

### SQLite

| Schema Type | SQLite Type |
|-------------|-------------|
| `string` | TEXT |
| `text` | TEXT |
| `uuid` | TEXT |
| `int` | INTEGER |
| `decimal` | REAL |
| `boolean` | INTEGER |
| `timestamp` | TEXT |
| `json` | TEXT |

---

## Complete Examples

### Blog System

```yaml
types:
  Slug: slug(3..200)
  Content: text(50000)

enums:
  PostStatus:
    values: [draft, published, archived]
    default: draft
  
  UserRole:
    values: [user, author, editor, admin]
    default: user

schemas:
  User:
    id: uuid! readonly generated
    email: email! unique indexed
    username: Slug! unique indexed
    password: string(60)! sensitive writeOnly
    firstName: string(2..50)!
    lastName: string(2..100)!
    bio: text(5000)?
    avatarUrl: url?
    role: UserRole = user
    isVerified: boolean = false
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
    deletedAt: timestamp?
    
    posts: Post[]
    comments: Comment[]
    
    computed:
      fullName: string = concat(firstName, ' ', lastName)
    
    variants:
      create:
        exclude: [id, createdAt, updatedAt, deletedAt, isVerified]
        override:
          password: string(8..100)!
      update:
        exclude: [id, email, createdAt, updatedAt, deletedAt]
        partial: true
      response:
        exclude: [password, deletedAt]
        include: [fullName]
      profile:
        pick: [id, username, firstName, lastName, bio, avatarUrl]
        include: [fullName]
    
    database:
      table: users
      indexes:
        - fields: [email]
          where: { deletedAt: null }
        - fields: [lastName, firstName]
  
  Post:
    id: uuid! readonly generated
    title: string(3..200)! indexed
    slug: Slug! unique indexed
    excerpt: string(500)?
    content: Content!
    coverImage: url?
    status: PostStatus = draft
    publishedAt: timestamp?
    viewCount: uint = 0
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
    
    author: User! cascade indexed
    category: Category! restrict indexed
    tags: Tag[] through:post_tags
    comments: Comment[]
    
    variants:
      create:
        exclude: [id, viewCount, publishedAt, createdAt, updatedAt]
      update:
        exclude: [id, author, createdAt, updatedAt]
        partial: true
      response:
        include: [author.profile, category, tags]
      list:
        exclude: [content]
        include: [author.profile]
    
    validation:
      publishedAtRequired:
        rule: custom
        expression: "status != 'published' OR publishedAt IS NOT NULL"
        message: "Published posts must have a publish date"
    
    database:
      indexes:
        - fields: [authorId, status]
        - fields: [status, publishedAt]
        - fields: [title, content]
          type: fulltext
  
  Category:
    id: uuid! readonly generated
    name: string(3..100)! unique
    slug: Slug! unique indexed
    description: text(1000)?
    parentId: uuid?
    order: int = 0
    
    posts: Post[]
    parent: Category? setNull
    children: Category[]
    
    database:
      indexes:
        - fields: [parentId, order]
  
  Tag:
    id: uuid! readonly generated
    name: string(2..50)! unique
    slug: Slug! unique indexed
    color: string(/^#[0-9A-Fa-f]{6}$/)?
    
    posts: Post[] through:post_tags
  
  Comment:
    id: uuid! readonly generated
    content: text(2000)!
    parentId: uuid?
    isEdited: boolean = false
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
    deletedAt: timestamp?
    
    author: User! cascade indexed
    post: Post! cascade indexed
    parent: Comment? setNull
    replies: Comment[]
    
    database:
      indexes:
        - fields: [postId, createdAt]
        - fields: [parentId]
```

### E-commerce System

```yaml
types:
  Money: decimal(19, 4, min: 0)
  SKU: string(3..50)
  PostalCode: string(/^\d{5}(-\d{4})?$/)

enums:
  OrderStatus:
    values: [pending, processing, shipped, delivered, cancelled]
    default: pending
  
  AddressType:
    values: [shipping, billing]

schemas:
  Customer:
    id: uuid! readonly generated
    email: email! unique indexed
    firstName: string(2..50)!
    lastName: string(2..100)!
    phone: phone?
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
    
    orders: Order[]
    addresses: Address[]
    
    computed:
      fullName: string = concat(firstName, ' ', lastName)
    
    variants:
      create:
        exclude: [id, createdAt, updatedAt]
      response:
        include: [fullName]
  
  Product:
    id: uuid! readonly generated
    sku: SKU! unique indexed
    name: string(3..200)! indexed
    description: text?
    price: Money!
    compareAtPrice: Money?
    cost: Money?
    stock: uint = 0
    lowStockThreshold: uint = 10
    weight: decimal(8, 3)?
    isActive: boolean = true
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
    
    category: Category! restrict indexed
    images: ProductImage[]
    orderItems: OrderItem[]
    
    variants:
      create:
        exclude: [id, createdAt, updatedAt]
      update:
        partial: true
        exclude: [id, sku, createdAt, updatedAt]
      response:
        include: [category, images]
      list:
        pick: [id, sku, name, price, stock, isActive]
    
    validation:
      comparePrice:
        rule: custom
        expression: "compareAtPrice IS NULL OR compareAtPrice > price"
        message: "Compare-at price must be greater than regular price"
    
    database:
      indexes:
        - fields: [categoryId, isActive]
        - fields: [price, isActive]
  
  Order:
    id: uuid! readonly generated
    orderNumber: string! unique indexed generated
    status: OrderStatus = pending
    subtotal: Money!
    tax: Money!
    shipping: Money!
    total: Money!
    notes: text?
    placedAt: timestamp!
    shippedAt: timestamp?
    deliveredAt: timestamp?
    cancelledAt: timestamp?
    createdAt: timestamp readonly = now()
    updatedAt: timestamp readonly = now() autoUpdate
    
    customer: Customer! cascade indexed
    items: OrderItem[]
    shippingAddress: Address!
    billingAddress: Address!
    
    variants:
      create:
        pick: [notes, shippingAddressId, billingAddressId]
      response:
        include: [customer, items, shippingAddress, billingAddress]
    
    database:
      indexes:
        - fields: [customerId, placedAt]
        - fields: [status, placedAt]
  
  OrderItem:
    id: uuid! readonly generated
    quantity: uint(min: 1) = 1
    price: Money!
    total: Money!
    
    order: Order! cascade indexed
    product: Product! restrict indexed
    
    computed:
      calculatedTotal: Money = price * quantity
  
  Address:
    id: uuid! readonly generated
    type: AddressType!
    firstName: string!
    lastName: string!
    company: string?
    address1: string!
    address2: string?
    city: string!
    state: string!
    postalCode: PostalCode!
    country: string = "US"
    phone: phone?
    isDefault: boolean = false
    createdAt: timestamp readonly = now()
    
    customer: Customer! cascade indexed
    
    database:
      indexes:
        - fields: [customerId, isDefault]
  
  Category:
    id: uuid! readonly generated
    name: string! unique
    slug: slug! unique indexed
    description: text?
    parentId: uuid?
    order: int = 0
    isActive: boolean = true
    
    products: Product[]
    parent: Category? setNull
    children: Category[]
  
  ProductImage:
    id: uuid! readonly generated
    url: url!
    alt: string?
    order: int = 0
    isPrimary: boolean = false
    
    product: Product! cascade indexed
```

---

## Migration from Old Syntax

### entities → schemas

```yaml
# Old
entities:
  User:
    fields:
      id: uuid!
      email: string!

# New
schemas:
  User:
    id: uuid!
    email: email!
```

### Field Syntax

```yaml
# Old
email: string? format: email

# New
email: email?
```

### Timestamps

```yaml
# Old
createdAt: timestamp default:now()

# New  
createdAt: timestamp = now()
```

### Relationships

```yaml
# Old (unchanged, but simplified)
author: User! onDelete:cascade indexed

# New
author: User! cascade indexed
```

---

## Implementation Phases

### Phase 1 (MVP)
- Basic types: `string`, `text`, `int`, `decimal`, `boolean`, `uuid`
- Date/time: `date`, `time`, `timestamp`
- JSON: `json`
- Enums: `enum(...)`
- Basic modifiers: `!`, `?`, `unique`, `indexed`, `= default`

### Phase 2
- Validation types: `email`, `url`, `slug`, `phone`
- Money: `money(currency)`
- Sized integers: `int8`, `int16`, `int32`, `int64`, `uint`
- Timezone variants: `timestamptz`, `timestamplocal`
- Advanced modifiers: `readonly`, `writeOnly`, `sensitive`, `generated`

### Phase 3
- Arrays: `type[]`
- Binary types: `binary`, `base64`
- Intervals: `interval`, `duration`
- Complex constraints: ranges, patterns
- Computed fields
- Variants system

### Phase 4
- Generic schemas
- Reusable types
- Advanced variant operations
- Full TypeScript codegen

---

## Best Practices

1. **Always use `uuid!` for primary keys** with `readonly generated`
2. **Add timestamps** - `createdAt` and `updatedAt` for audit trails
3. **Use semantic types** - `email` instead of `string` with format
4. **Mark sensitive fields** - `password: string! sensitive writeOnly`
5. **Use variants** - Auto-generate DTOs instead of manual schemas
6. **Index foreign keys** - Always add `indexed` to relationships
7. **Use enums for fixed values** - Better than string with validation
8. **Set sensible defaults** - Reduce required input
9. **Add soft deletes** - `deletedAt: timestamp?` for audit trails
10. **Use reusable types** - Define common patterns once

---

This documentation covers the complete YAMA type system. For API reference and code generation details, see the API documentation.
