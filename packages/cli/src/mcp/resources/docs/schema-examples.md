# YAMA Schema Examples

Common schema patterns and examples for YAMA entity definitions using the complete syntax reference.

## Basic Entity Examples

### Simple Todo Entity

```yaml
entities:
  Todo:
    fields:
      id: uuid!
      title: string! minLength:1 maxLength:200
      completed: boolean default:false
      createdAt: timestamp
      updatedAt: timestamp
```

### User Entity with Validations

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique indexed minLength:5 maxLength:255
      username: string! unique indexed minLength:3 maxLength:20
      passwordHash: string!
      role: enum[user, admin, moderator] default:user
      createdAt: timestamp
      updatedAt: timestamp
    validation:
      emailFormat:
        field: email
        rule: email
      usernamePattern:
        field: username
        rule: regex
        pattern: "^[a-zA-Z0-9_]+$"
        message: "Username can only contain letters, numbers, and underscores"
```

### Product Entity with Pricing

```yaml
entities:
  Product:
    fields:
      id: uuid!
      name: string! indexed minLength:3 maxLength:200
      description: text?
      price: decimal! precision:10 scale:2 min:0
      stock: integer! min:0 default:0
      sku: string! unique indexed maxLength:50
      published: boolean default:false
      createdAt: timestamp
      updatedAt: timestamp
```

## Relationship Examples

### One-to-Many: User and Posts

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique
      name: string!
      posts: Post[]              # hasMany

  Post:
    fields:
      id: uuid!
      title: string! indexed minLength:3 maxLength:200
      content: text!
      published: boolean default:false
      author: User! cascade indexed      # belongsTo - auto-generates authorId
      createdAt: timestamp
```

### Many-to-Many: Posts and Tags

```yaml
entities:
  Post:
    fields:
      id: uuid!
      title: string!
      content: text!
      tags: Tag[] through:post_tags  # manyToMany

  Tag:
    fields:
      id: uuid!
      name: string! unique maxLength:50
      slug: string! unique indexed
      posts: Post[]              # manyToMany (reverse)
```

### Many-to-Many with Join Table Metadata

```yaml
entities:
  Post:
    fields:
      id: uuid!
      title: string!
    relations:
      tags:
        type: manyToMany
        target: Tag
        through: post_tags
        timestamps: true
        fields:
          order: integer
          isPrimary: boolean
          addedAt: timestamp!

  Tag:
    fields:
      id: uuid!
      name: string! unique
    relations:
      posts:
        type: manyToMany
        target: Post
        through: post_tags
```

### One-to-One: User and Profile

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique
      name: string!
      profile: Profile?          # hasOne (nullable)

  Profile:
    fields:
      id: uuid!
      bio: text? maxLength:5000
      website: string?
      avatarUrl: string?
      user: User!                 # belongsTo - auto-generates userId
```

### Self-Referential: Comment Threading

```yaml
entities:
  Comment:
    fields:
      id: uuid!
      content: text! minLength:1 maxLength:2000
      parentId: uuid?
      createdAt: timestamp
    
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

### Complex Relationships: Blog System

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique indexed
      username: string! unique minLength:3 maxLength:20
      name: string!
      posts: Post[]
      comments: Comment[]

  Post:
    fields:
      id: uuid!
      title: string! indexed minLength:3 maxLength:200
      slug: string! unique indexed
      content: text!
      excerpt: text? maxLength:500
      published: boolean default:false
      publishedAt: timestamp?
      author: User! cascade indexed
      category: Category! restrict
      comments: Comment[]
      tags: Tag[] through:post_tags
      createdAt: timestamp
      updatedAt: timestamp
    indexes:
      - fields: [authorId, publishedAt]
      - fields: [status, publishedAt]
    validation:
      publishedAtRequired:
        rule: custom
        expression: "status != 'published' OR publishedAt IS NOT NULL"
        message: "Published posts must have a publish date"

  Comment:
    fields:
      id: uuid!
      content: text! minLength:1 maxLength:2000
      author: User! cascade indexed
      post: Post! cascade indexed
      parentId: uuid?
      createdAt: timestamp
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

  Tag:
    fields:
      id: uuid!
      name: string! unique maxLength:50
      slug: string! unique indexed
      posts: Post[] through:post_tags

  Category:
    fields:
      id: uuid!
      name: string! unique maxLength:100
      slug: string! unique indexed
      parentId: uuid?
      order: integer default:0
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
```

## E-commerce Examples

### Order System

```yaml
entities:
  Customer:
    fields:
      id: uuid!
      email: string! unique indexed
      firstName: string!
      lastName: string!
      orders: Order[]
      addresses: Address[]

  Order:
    fields:
      id: uuid!
      orderNumber: string! unique indexed
      status: enum[pending, processing, shipped, delivered, cancelled] default:pending
      total: decimal! precision:10 scale:2 min:0
      customer: Customer! cascade indexed
      items: OrderItem[]
      createdAt: timestamp
      updatedAt: timestamp
    indexes:
      - fields: [customerId, createdAt]
      - fields: [status, placedAt]

  Product:
    fields:
      id: uuid!
      name: string! indexed minLength:3 maxLength:200
      description: text?
      price: decimal! precision:10 scale:2 min:0
      stock: integer! min:0
      sku: string! unique indexed maxLength:50
      orderItems: OrderItem[]

  OrderItem:
    fields:
      id: uuid!
      quantity: integer! min:1 default:1
      price: decimal! precision:10 scale:2 min:0
      order: Order! cascade indexed
      product: Product! restrict indexed

  Address:
    fields:
      id: uuid!
      type: enum[shipping, billing]!
      firstName: string!
      lastName: string!
      address1: string!
      city: string!
      state: string!
      postalCode: string!
      country: string! default:US
      isDefault: boolean default:false
      customer: Customer! cascade indexed
    indexes:
      - fields: [customerId, isDefault]
      - fields: [postalCode]
```

## Named Enums Example

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
      id: uuid!
      title: string!
      status: PostStatus! default:draft

  User:
    fields:
      id: uuid!
      email: string! unique
      role: UserRole! default:user
```

## Index Examples

### Composite Indexes

```yaml
entities:
  Post:
    fields:
      id: uuid!
      authorId: uuid!
      published: boolean default:false
      publishedAt: timestamp?
      title: string!
    indexes:
      - fields: [authorId, publishedAt]
      - fields: [published, publishedAt]
      - fields: [title]
        type: btree
```

### Named Unique Indexes

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique
      username: string! unique
    indexes:
      - name: idx_user_email_username
        fields: [email, username]
        unique: true
```

### Partial Indexes

```yaml
entities:
  Post:
    fields:
      id: uuid!
      status: string!
      deletedAt: timestamp?
    indexes:
      - fields: [status]
        where: { deletedAt: null }
```

### Full-Text Search Index

```yaml
entities:
  Post:
    fields:
      id: uuid!
      title: string!
      content: text!
    indexes:
      - fields: [title, content]
        type: fulltext
        name: idx_post_search
```

### GIN Index for JSON

```yaml
entities:
  Product:
    fields:
      id: uuid!
      metadata: json
    indexes:
      - fields: [metadata]
        type: gin
```

## Validation Examples

### Field-Level Validation

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique indexed
      username: string! unique indexed
      age: integer?
      website: string?
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
      websiteUrl:
        field: website
        rule: url
```

### Entity-Level Validation

```yaml
entities:
  Event:
    fields:
      id: uuid!
      startDate: date!
      endDate: date!
    validation:
      dateOrder:
        rule: custom
        expression: "endDate >= startDate"
        message: "End date must be after start date"

  Product:
    fields:
      id: uuid!
      price: decimal! precision:10 scale:2
      compareAtPrice: decimal? precision:10 scale:2
    validation:
      comparePrice:
        rule: custom
        expression: "compareAtPrice IS NULL OR compareAtPrice > price"
        message: "Compare-at price must be greater than regular price"
```

## Advanced Relationship Examples

### Many-to-Many with Explicit Join Entity

```yaml
entities:
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
    indexes:
      - fields: [postId, tagId]
        unique: true
      - fields: [postId, order]
```

### Self-Referential Many-to-Many (User Followers)

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique
      username: string! unique
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

### Advanced HasMany with Ordering and Filtering

```yaml
entities:
  User:
    fields:
      id: uuid!
      email: string! unique
    relations:
      posts:
        type: hasMany
        target: Post
        foreignKey: authorId
        orderBy: createdAt desc
        where: { published: true }
```

## Polymorphic Relationship Example

```yaml
entities:
  Comment:
    fields:
      id: uuid!
      content: text!
      commentableType: string!
      commentableId: uuid!
    indexes:
      - fields: [commentableType, commentableId]

  Post:
    fields:
      id: uuid!
      title: string!
    relations:
      comments:
        type: hasMany
        target: Comment
        where: { commentableType: 'Post' }
        foreignKey: commentableId

  Video:
    fields:
      id: uuid!
      title: string!
    relations:
      comments:
        type: hasMany
        target: Comment
        where: { commentableType: 'Video' }
        foreignKey: commentableId
```

## Composite Primary Key Example

```yaml
entities:
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

## Complete E-commerce System

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

## Tips and Patterns

1. **Always use `uuid!` for primary keys** - Auto-generated UUIDs are recommended
2. **Add timestamps** - Include `createdAt` and `updatedAt` for audit trails
3. **Use inline relations** - They're cleaner and auto-generate foreign keys
4. **Index frequently queried fields** - Add `indexed` to fields used in WHERE clauses
5. **Use enums for status fields** - `enum[pending, active, completed]` is cleaner than strings
6. **Set defaults for boolean flags** - `published: boolean default:false` is clearer
7. **Use cascade carefully** - Only cascade delete when it makes sense
8. **Add soft deletes for important data** - Use `deletedAt: timestamp?` for audit trails
9. **Use named enums for reusability** - Define enums at the top level when used across multiple entities
10. **Add validation for business rules** - Use the `validation:` block for complex rules
11. **Use appropriate index types** - GIN for JSON, fulltext for search, partial indexes for filtered queries
12. **Add composite indexes** - For queries that filter or sort on multiple fields
