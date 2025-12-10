# Yama Philosophy

## The Configuration-First Backend Framework

Yama is a revolutionary approach to backend development that puts configuration at the center of the development process. This document outlines the core philosophy that drives Yama's design, architecture, and roadmap.

---

## Table of Contents

1. [Core Principles](#core-principles)
2. [The Configuration-First Paradigm](#the-configuration-first-paradigm)
3. [Architecture Philosophy](#architecture-philosophy)
4. [Developer Experience Philosophy](#developer-experience-philosophy)
5. [Plugin Ecosystem Philosophy](#plugin-ecosystem-philosophy)
6. [Production Philosophy](#production-philosophy)
7. [Community Philosophy](#community-philosophy)
8. [Implementation Philosophy](#implementation-philosophy)

---

## Core Principles

### 1. **Operations First, Code Second**

Yama's fundamental philosophy is that **business operations should be explicit and version-controlled, while implementation details remain in code**.

- **Operations** (what your API does) live in YAML configuration
- **Schemas** (data structures) are explicitly defined
- **Policies** (access control) are reusable and declarative
- **Logic** (custom behavior) lives in TypeScript handlers
- **Platform** (routing, validation, generation) is handled by Yama

This separation enables teams to build APIs that focus on business capabilities, with implementation details abstracted away.

### 2. **AI-Friendly Design**

Yama is designed to be **predictable and understandable by AI tools**. The configuration patterns are structured and consistent, making it easier for AI assistants to generate correct, working code.

### 3. **Progressive Enhancement**

Yama embraces **progressive enhancement** - start simple and add complexity as needed:

- Define schemas for your data structures
- Declare operations for your business logic
- Add policies for access control
- Expose operations through APIs
- Implement custom handlers for complex logic
- Extend with plugins for advanced features

### 4. **Zero Breaking Changes Philosophy**

As a v0 project, Yama **prioritizes backward compatibility and clean APIs over maintaining old patterns**. This enables rapid iteration and improvement without the burden of legacy support.

---

## The Configuration-First Paradigm

### Why Configuration-First?

Traditional backend frameworks require developers to write extensive boilerplate code for:

- Route definitions
- Request/response validation
- Database schema definitions
- Authentication rules
- API documentation

Yama flips this paradigm: **define your API behavior once in YAML, and let the platform handle the rest**.

### Operations-First Approach

Yama introduces an **operations-first** approach that focuses on **what your API does** rather than **how it's implemented**:

- **Operations** define business logic and API behavior
- **APIs** expose operations through different interfaces (REST, GraphQL)
- **Policies** provide reusable access control
- **Schemas** define data structures and relationships

This separation enables teams to build APIs that are:
- **Semantic**: Operations describe business capabilities
- **Flexible**: Same operations can be exposed through multiple APIs
- **Secure**: Policies can be reused across operations
- **Maintainable**: Clear separation of concerns

### Configuration Benefits

1. **Version Control**: API contracts are explicitly versioned alongside code
2. **Reviewable**: Configuration changes are easy to review and understand
3. **Maintainable**: Single source of truth for API behavior
4. **Testable**: Configuration can be validated and tested
5. **Generatable**: Tools can generate clients, docs, and types automatically
6. **Shareable**: Teams can share and reuse configurations

### The YAML Contract

Your `yama.yaml` file becomes the **single source of truth** for your API:

```yaml
project:
  name: blog-api
  version: 1.0.0

# Data definitions
schemas:
  Post:
    database: posts
    fields:
      id: uuid!
      title: string!
      content: text!
      published: boolean = false
      author: Author! cascade

  Author:
    database: authors
    fields:
      id: uuid!
      name: string!
      email: string! unique

# Business operations
operations:
  listPosts: PostSummary[]
  getPost: PostDetail
  createPost: Post
  searchPosts:
    input:
      q: string!
      limit: number = 20
    output: PostSummary[]

# Access control
policies:
  public:
    auth: false
  author:
    auth:
      required: true
      roles: [author, admin]

# API exposure
apis:
  rest:
    public:
      basePath: /api/v1
      defaultPolicy: public
      operations:
        - listPosts
        - getPost
        - searchPosts
        - createPost: author
```

This configuration generates:
- ✅ Complete REST API with proper routing
- ✅ Type-safe operations with input/output validation
- ✅ Reusable access control policies
- ✅ TypeScript types and SDK
- ✅ API documentation
- ✅ Database operations and migrations

---

## Architecture Philosophy

### Plugin-Based Architecture

Yama's architecture is built around **extensible plugins** that provide specific capabilities:

- **Database Adapters**: PostgreSQL, PGLite, SQLite, MySQL
- **HTTP Servers**: Fastify, Express, Hono
- **Authentication**: JWT, OAuth, MFA, Passkeys
- **Services**: Email, Payments, Queues, Cache
- **Deployment Targets**: Vercel, Netlify, AWS Lambda, Docker

This plugin architecture enables:
- **Modularity**: Use only what you need
- **Extensibility**: Add custom functionality
- **Community**: Third-party plugins expand capabilities
- **Performance**: Load only required components

### Operations & Handler Context Pattern

Yama provides an **operations-first** approach where handlers work with business operations:

```typescript
// Operations are auto-generated from config
export async function publishPost(context: OperationContext) {
  const { id } = context.input; // Type-safe input from operation definition

  // Database access through schemas
  const post = await context.db.posts.findById(id);
  post.published = true;
  post.publishedAt = new Date();

  await context.db.posts.update(id, post);

  // Return type-safe output
  return post;
}

// Rich handler context with everything needed
export async function myHandler(context: HandlerContext) {
  // Database access through schemas
  const posts = await context.db.posts.findAll();

  // Authentication & authorization
  const userId = context.auth.user?.id;
  const isAuthor = context.auth.can('author');

  // Services (email, payments, etc.)
  await context.email?.send({ to: '...', subject: '...' });

  // Session management
  context.session?.set('cart', items);

  // Policy checking
  if (!context.policy.check('author')) {
    throw new Error('Unauthorized');
  }

  // Custom business logic
  return processPosts(posts);
}
```

Operations provide type safety, automatic validation, and clear contracts while handlers focus on business logic.

### Type Safety Everywhere

Yama generates **end-to-end type safety**:

- **Configuration Types**: YAML is validated and typed
- **Handler Types**: Context and parameters are fully typed
- **Client SDK**: Generated clients are type-safe
- **Database Models**: Schema types are auto-generated

### Smart Defaults, Explicit Overrides

Yama provides **sensible defaults** while allowing full customization:

- Standard operations (CRUD) work out of the box
- Default handlers auto-generate from operation signatures
- Policies provide reusable access control
- APIs auto-generate routing and validation
- Plugins configure themselves optimally

But when you need control:
- Define custom operations with specific input/output
- Implement custom handlers for complex business logic
- Create custom policies for fine-grained access control
- Configure APIs with specific routing and middleware
- Override defaults with explicit configurations

---

## Developer Experience Philosophy

### Reduce Boilerplate, Increase Productivity

Yama eliminates **90% of typical backend boilerplate**:

- **No route definitions** - Auto-generated from operations and APIs
- **No validation code** - Automatic from operation input/output schemas
- **No database boilerplate** - Schema-based data access
- **No auth boilerplate** - Policy-based access control
- **No API documentation** - Auto-generated from operations and schemas

### Hot Reload & Instant Feedback

Yama prioritizes **developer productivity** with:

- **Hot reload** during development
- **Instant API updates** when configuration changes
- **Auto-generated types** that update immediately
- **Watch mode** for continuous development
- **Rich error messages** and validation

### Progressive Complexity

Start simple, add complexity as needed:

1. **Level 1**: Define schemas → Data structure foundation
2. **Level 2**: Define operations → Business logic API
3. **Level 3**: Add policies → Access control
4. **Level 4**: Expose via APIs → Multiple interfaces (REST, GraphQL)
5. **Level 5**: Custom handlers → Complex business logic
6. **Level 6**: Plugins → Advanced features
7. **Level 7**: Custom plugins → Domain-specific functionality

### AI-Assisted Development

Yama is designed to be **AI-friendly**:

- **Semantic operations**: AI can understand business logic from operation names
- **Type-safe contracts**: Input/output schemas provide clear AI guidance
- **Policy-based security**: AI can reason about access control
- **Predictable patterns**: Operations follow consistent conventions
- **Clear separation**: Schemas, operations, policies, and APIs are distinct concerns

---

## Plugin Ecosystem Philosophy

### Official vs Community Plugins

Yama maintains a **tiered plugin ecosystem**:

- **Tier 1: Core** - Built into yama-core (JWT, API keys, RBAC)
- **Tier 2: Official** - First-party plugins (OAuth, email, logging)
- **Tier 3: Vendor** - Third-party service integrations (Clerk, Auth0)
- **Tier 4: Community** - User-contributed plugins

### Plugin Quality Standards

All plugins follow **strict quality standards**:

- **Type Safety**: Full TypeScript support
- **Documentation**: Comprehensive guides and examples
- **Testing**: Automated test suites
- **Security**: Security audits for official plugins
- **Compatibility**: Version compatibility guarantees

### Plugin Discovery & Adoption

Yama makes plugin discovery effortless:

```bash
# Search for plugins
yama plugin search email

# Browse by category
yama plugin browse --category database

# Install with one command
yama plugin install @betagors/yama-email-sendgrid
```

### Plugin Development Tools

Yama provides **comprehensive tooling** for plugin developers:

```bash
# Create plugin scaffold
yama plugin create my-plugin --category database

# Validate plugin structure
yama plugin validate

# Test plugin integration
yama plugin test
```

---

## Production Philosophy

### Production-Ready by Default

Yama is designed for **production deployment from day one**:

- **Security**: Built-in security headers, CSRF protection, rate limiting
- **Monitoring**: Comprehensive logging, metrics, and error tracking
- **Health Checks**: Readiness/liveness endpoints, dependency checks
- **Performance**: Optimized builds, caching, connection pooling
- **Reliability**: Circuit breakers, retries, graceful shutdown

### Multi-Platform Deployment

Yama supports **any deployment target**:

```bash
# Serverless
yama deploy --target vercel
yama deploy --target netlify

# Containers
yama deploy --target docker

# Traditional
yama deploy --target node --pm2
```

### Environment Management

Yama provides **sophisticated environment management**:

```yaml
# yama.prod.yaml
database:
  connection:
    host: ${DB_HOST}
    ssl: true

plugins:
  logging:
    level: warn
    format: json
```

### Migration Safety

Yama treats **database migrations as first-class citizens**:

- **Safety checks**: Prevent destructive operations in production
- **Rollback support**: Safe rollback strategies
- **Audit logging**: Complete migration history
- **Dependency tracking**: Migration prerequisites

---

## Community Philosophy

### Open Source First

Yama is **open source by design**:

- **Transparent**: All code is open and auditable
- **Community-driven**: Features driven by real user needs
- **Contributing**: Easy contribution process with clear guidelines
- **Governance**: Community oversight and decision-making

### Inclusive Development

Yama welcomes **contributors from all backgrounds**:

- **Beginner-friendly**: Clear documentation and examples
- **Mentorship**: Community support for new contributors
- **Diversity**: Multiple ways to contribute (code, docs, plugins, testing)
- **Recognition**: Credit and recognition for all contributions

### Ecosystem Growth

Yama actively **grows its ecosystem**:

- **Plugin marketplace**: Centralized plugin discovery
- **Community plugins**: User-contributed extensions
- **Integration libraries**: SDKs for popular frameworks
- **Educational content**: Tutorials, courses, and examples

---

## Implementation Philosophy

### Pragmatic Innovation

Yama balances **innovation with practicality**:

- **Bold ideas**: Configuration-first, plugin architecture, AI-friendly design
- **Practical execution**: Works with existing tools, familiar patterns, real-world constraints
- **Incremental adoption**: Can be adopted gradually, integrates with existing systems

### Performance as Priority

Yama optimizes for **real-world performance**:

- **Fast startup**: Minimal initialization overhead
- **Efficient routing**: Optimized request handling
- **Memory efficient**: Smart caching and resource management
- **Scalable**: Horizontal scaling support

### Testability

Yama emphasizes **testability at every level**:

- **Configuration testing**: YAML validation and schema testing
- **Handler testing**: Isolated unit tests with mock contexts
- **Integration testing**: Full API testing
- **Plugin testing**: Plugin isolation and compatibility testing

### Documentation Excellence

Yama maintains **comprehensive documentation**:

- **API docs**: Auto-generated from configuration
- **Developer guides**: Step-by-step tutorials
- **Plugin docs**: Complete plugin documentation
- **Architecture docs**: Design decisions and rationale
- **Migration guides**: Smooth upgrade paths

---

## The Yama Promise

Yama promises to **revolutionize backend development** by:

1. **Operations-first design** - Define what your API does, not how it works
2. **Semantic configuration** - Business logic is clear, maintainable, and versioned
3. **Type-safe by default** - End-to-end type safety from config to client
4. **Production-ready foundation** - Enterprise features built-in, not bolted-on
5. **AI-assisted development** - Predictable patterns that AI tools can reliably generate
6. **Community ecosystem** - Open platform with thriving plugin community

Yama is more than a framework—it's a **new paradigm for backend development**, where operations become APIs, policies ensure security, and configuration drives capability.

---

*"Yama: Where operations meet APIs, and business logic becomes configuration."*