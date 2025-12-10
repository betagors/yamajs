# YAML Schema Syntax - Complete Reference

## Overview

This document describes the complete YAML schema syntax for defining entities, fields, relationships, and database configurations.

---

## Basic Structure

```yaml
entities:
  EntityName:
    fields:
      fieldName: type [modifiers]
    
    # Inline relationships
    relationName: TargetEntity [modifiers]
    
    # Advanced relationships
    relations:
      relationName:
        type: relationType
        target: TargetEntity
        # ... configuration
    
    # Indexes
    indexes:
      - fields: [field1, field2]
        unique: boolean
    
    # Validation rules
    validation:
      ruleName: expression
```

---

## Field Types

### Primitive Types

| Type | Database Type | Description | Example |
|------|---------------|-------------|---------|
| `string` | VARCHAR(255) | Variable length text | `name: string` |
| `text` | TEXT | Long text content | `content: text` |
| `integer` | INTEGER | Whole numbers | `age: integer` |
| `decimal` | DECIMAL | Decimal numbers | `price: decimal` |
| `boolean` | BOOLEAN | True/false values | `isActive: boolean` |
| `uuid` | UUID | UUID identifier | `id: uuid` |
| `timestamp` | TIMESTAMP | Date and time | `createdAt: timestamp` |
| `date` | DATE | Date only | `birthDate: date` |
| `time` | TIME | Time only | `startTime: time` |
| `json` | JSONB | JSON data | `metadata: json` |
| `enum` | Custom ENUM | Enumerated values | `status: enum` |

### Field Modifiers

**Required/Optional:**

- `!` - Required (NOT NULL)
- `?` - Optional (nullable) - default if no modifier

**Examples:**

```yaml
email: string!      # Required
bio: text?          # Optional (explicit)
name: string        # Optional (implicit)
```

---

## Field Constraints (Inline)

### Basic Constraints

```yaml
# Uniqueness
email: string! unique
username: string! unique indexed

# Indexing
title: string indexed
slug: string! unique indexed

# Default values
status: string default:active
isPublished: boolean default:false
createdAt: timestamp default:now()

# Numeric constraints
age: integer min:18 max:120
price: decimal min:0 max:999999.99
rating: decimal min:0.0 max:5.0

# String length
username: string minLength:3 maxLength:20
bio: text maxLength:5000

# Decimal precision
price: decimal precision:10 scale:2
latitude: decimal precision:10 scale:8
```

### Combined Constraints

```yaml
email: string! unique indexed minLength:5 maxLength:255
age: integer! min:0 max:150 default:0
price: decimal! precision:10 scale:2 min:0 indexed
```

---

## Relationships

### 1. One-to-Many (belongsTo / hasMany)

**Simple Inline Syntax:**

```yaml
User:
  fields:
    id: uuid!
    name: string!
  
  posts: Post[]          # hasMany

Post:
  fields:
    id: uuid!
    title: string!
  
  author: User!          # belongsTo
```

**Generated:**

- Foreign key `author_id` in `posts` table
- References `users(id)`

**With Modifiers:**

```yaml
Post:
  # Cascade delete
  author: User! cascade
  
  # Set null on delete
  reviewer: User? setNull
  
  # Restrict delete (default)
  category: Category! restrict
  
  # Add index
  author: User! cascade indexed
```

**Advanced Configuration:**

```yaml
Post:
  relations:
    author:
      type: belongsTo
      target: User
      foreignKey: authorId      # Custom FK name
      references: id            # Column in target table
      onDelete: cascade         # cascade | setNull | restrict
      onUpdate: cascade         # cascade | setNull | restrict
      indexed: true
      nullable: false

User:
  relations:
    posts:
      type: hasMany
      target: Post
      foreignKey: authorId
      orderBy: createdAt desc
      where: { published: true }
```

---

### 2. Many-to-Many

**Simple Inline Syntax:**

```yaml
Post:
  tags: Tag[]

Tag:
  posts: Post[]
```

**Generated:**

- Join table: `post_tags`
- Columns: `post_id`, `tag_id`
- Composite primary key: `(post_id, tag_id)`
- Timestamps: `created_at`

**With Custom Join Table:**

```yaml
Post:
  tags: Tag[] through:post_tagging

Tag:
  posts: Post[] through:post_tagging
```

**With Join Table Metadata:**

```yaml
Post:
  relations:
    tags:
      type: manyToMany
      target: Tag
      through: post_tags
      timestamps: true        # Add created_at, updated_at
      fields:                 # Extra fields on join table
        order: integer
        isPrimary: boolean
        addedAt: timestamp!
        addedBy: uuid

Tag:
  relations:
    posts:
      type: manyToMany
      target: Post
      through: post_tags
```

**Explicit Join Entity (Full Control):**

```yaml
Post:
  postTags: PostTag[]

Tag:
  postTags: PostTag[]

PostTag:
  fields:
    id: uuid!
    postId: uuid!
    tagId: uuid!
    order: integer! default:0
    isPrimary: boolean default:false
    addedAt: timestamp! default:now()
    addedBy: uuid?
  
  relations:
    post:
      type: belongsTo
      target: Post
      foreignKey: postId
      onDelete: cascade
    
    tag:
      type: belongsTo
      target: Tag
      foreignKey: tagId
      onDelete: cascade
    
    addedByUser:
      type: belongsTo
      target: User
      foreignKey: addedBy
  
  indexes:
    - fields: [postId, tagId]
      unique: true
    - fields: [postId, order]
```

---

### 3. One-to-One

**Simple Inline Syntax:**

```yaml
User:
  profile: Profile?

Profile:
  user: User!
```

**Advanced Configuration:**

```yaml
User:
  relations:
    profile:
      type: hasOne
      target: Profile
      foreignKey: userId

Profile:
  fields:
    userId: uuid! unique
  
  relations:
    user:
      type: belongsTo
      target: User
      foreignKey: userId
      onDelete: cascade
```

---

### 4. Self-Referential Relationships

**Simple Tree Structure:**

```yaml
Comment:
  fields:
    id: uuid!
    content: text!
    parentId: uuid?
  
  relations:
    parent:
      type: belongsTo
      target: Comment
      foreignKey: parentId
    
    replies:
      type: hasMany
      target: Comment
      foreignKey: parentId
      orderBy: createdAt asc
```

**User Followers (Many-to-Many):**

```yaml
User:
  relations:
    followers:
      type: manyToMany
      target: User
      through: user_followers
      joinColumns:
        from: followerId
        to: followingId
    
    following:
      type: manyToMany
      target: User
      through: user_followers
      joinColumns:
        from: followingId
        to: followerId
```

---

## Indexes

### Simple Index

```yaml
User:
  fields:
    email: string! unique      # Automatic unique index
    lastName: string indexed   # Automatic index
```

### Composite Indexes

```yaml
User:
  fields:
    firstName: string
    lastName: string
    email: string! unique
  
  indexes:
    - fields: [lastName, firstName]
      name: idx_user_name
    
    - fields: [email, status]
      unique: true
    
    - fields: [createdAt]
      type: btree
      where: { deletedAt: null }
```

### Index Types

```yaml
indexes:
  # B-tree (default)
  - fields: [name]
    type: btree
  
  # Hash
  - fields: [id]
    type: hash
  
  # GIN (for JSON, arrays)
  - fields: [metadata]
    type: gin
  
  # Partial index
  - fields: [status]
    where: { deletedAt: null }
  
  # Full-text search
  - fields: [title, content]
    type: fulltext
```

---

## Validation Rules

### Field-Level Validation

```yaml
User:
  fields:
    email: string!
    age: integer
    username: string!
  
  validation:
    emailFormat:
      field: email
      rule: email
    
    ageRange:
      field: age
      rule: between
      params: [13, 120]
    
    usernamePattern:
      field: username
      rule: regex
      pattern: "^[a-zA-Z0-9_]+$"
      message: "Username can only contain letters, numbers, and underscores"
```

### Entity-Level Validation

```yaml
Event:
  fields:
    startDate: date!
    endDate: date!
  
  validation:
    dateOrder:
      rule: custom
      expression: "endDate >= startDate"
      message: "End date must be after start date"
```

---

## Enums

### Inline Enum

```yaml
Post:
  fields:
    status: enum[draft, published, archived]
    visibility: enum[public, private, unlisted]!
```

### Named Enum (Reusable)

```yaml
enums:
  PostStatus:
    values: [draft, published, archived]
    default: draft
  
  UserRole:
    values: [user, admin, moderator]
    default: user

entities:
  Post:
    fields:
      status: PostStatus!
  
  User:
    fields:
      role: UserRole! default:user
```

---

## Special Fields

### Timestamps

```yaml
User:
  fields:
    # Auto-managed timestamp fields
    createdAt: timestamp       # Set on INSERT
    updatedAt: timestamp       # Updated on UPDATE
    deletedAt: timestamp?      # Soft delete (nullable)
```

**Generated behavior:**

- `createdAt` - Auto-set to NOW() on creation
- `updatedAt` - Auto-update to NOW() on modification
- `deletedAt` - Enables soft delete pattern

### Audit Fields

```yaml
Post:
  fields:
    id: uuid!
    title: string!
    createdAt: timestamp
    updatedAt: timestamp
    createdBy: uuid
    updatedBy: uuid
  
  relations:
    creator:
      type: belongsTo
      target: User
      foreignKey: createdBy
    
    updater:
      type: belongsTo
      target: User
      foreignKey: updatedBy
```

---

## Complete Examples

### Blog System

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique indexed
      username: string! unique minLength:3 maxLength:20
      password: string!
      firstName: string
      lastName: string
      bio: text? maxLength:5000
      avatarUrl: string?
      isVerified: boolean default:false
      role: enum[user, moderator, admin] default:user
      createdAt: timestamp
      updatedAt: timestamp
      deletedAt: timestamp?
    
    posts: Post[]
    comments: Comment[]
    followers: UserFollower[]
    
    indexes:
      - fields: [lastName, firstName]
      - fields: [email]
        where: { deletedAt: null }

  Post:
    fields:
      id: uuid!
      title: string! indexed minLength:3 maxLength:200
      slug: string! unique indexed
      content: text!
      excerpt: text? maxLength:500
      coverImage: string?
      status: enum[draft, published, archived] default:draft
      publishedAt: timestamp?
      viewCount: integer default:0 min:0
      createdAt: timestamp
      updatedAt: timestamp
    
    author: User! cascade indexed
    category: Category! restrict
    tags: Tag[] through:post_tags
    comments: Comment[]
    
    indexes:
      - fields: [status, publishedAt]
      - fields: [authorId, createdAt]
    
    validation:
      publishedAtRequired:
        rule: custom
        expression: "status != 'published' OR publishedAt IS NOT NULL"
        message: "Published posts must have a publish date"

  Category:
    fields:
      id: uuid!
      name: string! unique maxLength:100
      slug: string! unique indexed
      description: text?
      parentId: uuid?
      order: integer default:0
      createdAt: timestamp
    
    posts: Post[]
    
    relations:
      parent:
        type: belongsTo
        target: Category
        foreignKey: parentId
      
      children:
        type: hasMany
        target: Category
        foreignKey: parentId
        orderBy: order asc

  Tag:
    fields:
      id: uuid!
      name: string! unique maxLength:50
      slug: string! unique indexed
      color: string? pattern:"^#[0-9A-Fa-f]{6}$"
      createdAt: timestamp
    
    posts: Post[] through:post_tags

  Comment:
    fields:
      id: uuid!
      content: text! minLength:1 maxLength:2000
      parentId: uuid?
      isEdited: boolean default:false
      createdAt: timestamp
      updatedAt: timestamp
      deletedAt: timestamp?
    
    author: User! cascade indexed
    post: Post! cascade indexed
    
    relations:
      parent:
        type: belongsTo
        target: Comment
        foreignKey: parentId
      
      replies:
        type: hasMany
        target: Comment
        foreignKey: parentId
        where: { deletedAt: null }
        orderBy: createdAt asc
    
    indexes:
      - fields: [postId, createdAt]
      - fields: [authorId, createdAt]

  UserFollower:
    fields:
      id: uuid!
      followerId: uuid!
      followingId: uuid!
      createdAt: timestamp
    
    relations:
      follower:
        type: belongsTo
        target: User
        foreignKey: followerId
        onDelete: cascade
      
      following:
        type: belongsTo
        target: User
        foreignKey: followingId
        onDelete: cascade
    
    indexes:
      - fields: [followerId, followingId]
        unique: true
      - fields: [followingId, createdAt]
```

### E-commerce System

```yaml
entities:
  Customer:
    fields:
      id: uuid!
      email: string! unique indexed
      firstName: string!
      lastName: string!
      phone: string? pattern:"^\\+?[1-9]\\d{1,14}$"
      createdAt: timestamp
      updatedAt: timestamp
    
    orders: Order[]
    addresses: Address[]
    reviews: Review[]

  Product:
    fields:
      id: uuid!
      sku: string! unique indexed maxLength:50
      name: string! indexed minLength:3 maxLength:200
      description: text
      price: decimal! precision:10 scale:2 min:0
      compareAtPrice: decimal? precision:10 scale:2 min:0
      cost: decimal? precision:10 scale:2 min:0
      stock: integer! default:0 min:0
      lowStockThreshold: integer default:10 min:0
      weight: decimal? precision:8 scale:2 min:0
      isActive: boolean default:true
      createdAt: timestamp
      updatedAt: timestamp
    
    category: Category! restrict indexed
    orderItems: OrderItem[]
    reviews: Review[]
    images: ProductImage[]
    
    indexes:
      - fields: [categoryId, isActive]
      - fields: [price, isActive]
    
    validation:
      comparePrice:
        rule: custom
        expression: "compareAtPrice IS NULL OR compareAtPrice > price"
        message: "Compare-at price must be greater than regular price"

  Order:
    fields:
      id: uuid!
      orderNumber: string! unique indexed
      status: enum[pending, processing, shipped, delivered, cancelled] default:pending
      subtotal: decimal! precision:10 scale:2 min:0
      tax: decimal! precision:10 scale:2 min:0
      shipping: decimal! precision:10 scale:2 min:0
      total: decimal! precision:10 scale:2 min:0
      notes: text?
      shippingAddressId: uuid!
      billingAddressId: uuid!
      placedAt: timestamp!
      shippedAt: timestamp?
      deliveredAt: timestamp?
      cancelledAt: timestamp?
      createdAt: timestamp
      updatedAt: timestamp
    
    customer: Customer! cascade indexed
    items: OrderItem[]
    
    relations:
      shippingAddress:
        type: belongsTo
        target: Address
        foreignKey: shippingAddressId
      
      billingAddress:
        type: belongsTo
        target: Address
        foreignKey: billingAddressId
    
    indexes:
      - fields: [customerId, placedAt]
      - fields: [status, placedAt]
      - fields: [orderNumber]

  OrderItem:
    fields:
      id: uuid!
      quantity: integer! min:1 default:1
      price: decimal! precision:10 scale:2 min:0
      total: decimal! precision:10 scale:2 min:0
    
    order: Order! cascade indexed
    product: Product! restrict indexed

  Address:
    fields:
      id: uuid!
      type: enum[shipping, billing]!
      firstName: string!
      lastName: string!
      company: string?
      address1: string!
      address2: string?
      city: string!
      state: string!
      postalCode: string!
      country: string! default:US
      phone: string?
      isDefault: boolean default:false
      createdAt: timestamp
      updatedAt: timestamp
    
    customer: Customer! cascade indexed
    
    indexes:
      - fields: [customerId, isDefault]
      - fields: [postalCode]

  Review:
    fields:
      id: uuid!
      rating: integer! min:1 max:5
      title: string? maxLength:200
      content: text? maxLength:5000
      isVerified: boolean default:false
      createdAt: timestamp
      updatedAt: timestamp
    
    customer: Customer! cascade indexed
    product: Product! cascade indexed
    
    indexes:
      - fields: [productId, createdAt]
      - fields: [customerId, productId]
        unique: true

  Category:
    fields:
      id: uuid!
      name: string! unique maxLength:100
      slug: string! unique indexed
      description: text?
      parentId: uuid?
      order: integer default:0
      isActive: boolean default:true
    
    products: Product[]
    
    relations:
      parent:
        type: belongsTo
        target: Category
        foreignKey: parentId
      
      children:
        type: hasMany
        target: Category
        foreignKey: parentId
        orderBy: order asc

  ProductImage:
    fields:
      id: uuid!
      url: string!
      alt: string?
      order: integer default:0
      isPrimary: boolean default:false
      createdAt: timestamp
    
    product: Product! cascade indexed
    
    indexes:
      - fields: [productId, order]
```

---

## Cascade Behavior Reference

| onDelete | Behavior |
|----------|----------|
| `cascade` | Delete related records |
| `setNull` | Set foreign key to NULL (requires nullable FK) |
| `restrict` | Prevent deletion if related records exist (default) |
| `noAction` | No action (similar to restrict) |

**Examples:**

```yaml
# Delete posts when user is deleted
Post:
  author: User! cascade

# Nullify reviewer when user is deleted
Post:
  reviewer: User? setNull

# Prevent category deletion if posts exist
Post:
  category: Category! restrict
```

---

## Naming Conventions

### Automatic Naming

- **Tables**: Pluralized, snake_case entity names
  - `User` → `users`
  - `BlogPost` → `blog_posts`

- **Foreign Keys**: `{relation}_id`
  - `author: User` → `author_id`
  - `blogPost: BlogPost` → `blog_post_id`

- **Join Tables**: `{entity1}_{entity2}` (alphabetical)
  - `Post + Tag` → `post_tags`
  - `User + Role` → `role_users`

### Custom Naming

```yaml
Post:
  relations:
    author:
      type: belongsTo
      target: User
      foreignKey: createdBy      # Custom FK name
      references: userId         # Custom target column

    tags:
      type: manyToMany
      target: Tag
      through: post_tagging      # Custom join table
      joinColumns:
        from: postId            # Custom columns
        to: tagId
```

---

## Best Practices

### 1. Always Add Timestamps

```yaml
createdAt: timestamp
updatedAt: timestamp
```

### 2. Use Appropriate Cascade Behavior

```yaml
# User owns posts - cascade delete
author: User! cascade

# Posts reference categories - prevent deletion
category: Category! restrict

# Optional relationships - set null
reviewer: User? setNull
```

### 3. Add Indexes for Foreign Keys

```yaml
author: User! cascade indexed
```

### 4. Use Enums for Fixed Value Sets

```yaml
status: enum[draft, published, archived] default:draft
```

### 5. Add Validation for Business Rules

```yaml
validation:
  endAfterStart:
    rule: custom
    expression: "endDate >= startDate"
```

### 6. Use Unique Constraints

```yaml
email: string! unique
slug: string! unique indexed
```

### 7. Set Sensible Defaults

```yaml
status: string default:active
viewCount: integer default:0
isPublished: boolean default:false
```

---

## Migration from Other ORMs

### From Prisma

```prisma
// Prisma
model Post {
  id        String   @id @default(uuid())
  title     String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
}
```

```yaml
# Your Schema
Post:
  fields:
    id: uuid!
    title: string!
  
  author: User! cascade
```

### From TypeORM

```typescript
// TypeORM
@Entity()
class Post {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  title: string;
  
  @ManyToOne(() => User, user => user.posts, { onDelete: 'CASCADE' })
  author: User;
}
```

```yaml
# Your Schema
Post:
  fields:
    id: uuid!
    title: string!
  
  author: User! cascade
```

---

## Advanced Features

### Polymorphic Relationships

```yaml
Comment:
  fields:
    id: uuid!
    content: text!
    commentableType: string!
    commentableId: uuid!
  
  indexes:
    - fields: [commentableType, commentableId]

Post:
  relations:
    comments:
      type: hasMany
      target: Comment
      where: { commentableType: 'Post' }
      foreignKey: commentableId

Video:
  relations:
    comments:
      type: hasMany
      target: Comment
      where: { commentableType: 'Video' }
      foreignKey: commentableId
```

### Composite Primary Keys

```yaml
UserRole:
  fields:
    userId: uuid!
    roleId: uuid!
    grantedAt: timestamp!
  
  primaryKey: [userId, roleId]
  
  relations:
    user:
      type: belongsTo
      target: User
      foreignKey: userId
    
    role:
      type: belongsTo
      target: Role
      foreignKey: roleId
```

### JSON Fields

```yaml
Product:
  fields:
    metadata: json
    specifications: json
    customFields: json?
  
  indexes:
    - fields: [metadata]
      type: gin
```

### Full-Text Search

```yaml
Post:
  fields:
    title: string!
    content: text!
  
  indexes:
    - fields: [title, content]
      type: fulltext
```

---

This is the complete syntax reference. For implementation details and generated code examples, refer to the API documentation.
