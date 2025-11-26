# YAMA Roadmap

This document outlines planned features and improvements for YAMA, organized by strategic priority and implementation phases.

## Strategic Implementation Order

The roadmap is organized into tiers based on dependencies, production readiness, and developer experience:

- **TIER 1: Foundation & Core DX** - Enables everything else, improves developer experience
- **TIER 2: Production Essentials** - Required for production deployments
- **TIER 3: Microservices & Inter-Service Communication** - Enables microservices architecture
- **TIER 4: Enhanced Developer Experience** - Improves productivity and adoption
- **TIER 5: Advanced Features** - Nice-to-haves and optimizations

---

## TIER 1: Backend-as-Config Enhancements (Foundation)

### Current State
- ✅ CRUD endpoints are fully config-based (no code required)
- ✅ Custom endpoints can be defined in YAML but require TypeScript handler files
- ⚠️ Default handlers only return placeholder messages
- ⚠️ Handlers must manually import database repositories

### Planned Features

#### 1. Database Access in Handler Context
**Priority: High | TIER 1**

Add database access to `HandlerContext` so handlers can use repositories without manual imports.

**Implementation:**
- Populate `context.db` with the database adapter
- Provide entity repositories through `context.repositories` or `context.entities`
- Allow handlers to access database operations directly from context

**Example:**
```typescript
export async function myHandler(context: HandlerContext) {
  const products = await context.entities.Product.findAll();
  return products;
}
```

**Benefits:**
- Reduces boilerplate in handlers
- Makes database access consistent across handlers
- Enables easier testing and mocking

---

#### 2. Smart Default Handlers for Entity Endpoints
**Priority: High | TIER 1**

Enable endpoints without handlers to automatically query entity repositories based on response type detection.

**Current State:**
- Endpoints without handlers use `createDefaultHandler` which returns placeholder messages
- No automatic database querying for entity-based endpoints

**Implementation:**
- Enhance `createDefaultHandler` to detect entity-based response types (e.g., `ProductArray`, `Product`)
- Dynamically load and use the appropriate repository based on entity name
- Support CRUD operations automatically:
  - `GET /path` with `ProductArray` response → calls `productRepository.findAll(query)`
  - `GET /path/:id` with `Product` response → calls `productRepository.findById(params.id)`
  - `POST /path` with `Product` response → calls `productRepository.create(body)`
  - `PUT/PATCH /path/:id` → calls `productRepository.update(params.id, body)`
  - `DELETE /path/:id` → calls `productRepository.delete(params.id)`
- Map query parameters to repository method options
- Support pagination, filtering, and sorting through query parameters

**Example:**
```yaml
endpoints:
  - path: /featured-products
    method: GET
    # No handler specified - auto-detects ProductArray and queries repository
    query:
      featured: { type: "boolean", required: false }
      limit: { type: "number", required: false }
      offset: { type: "number", required: false }
    response:
      type: ProductArray
```

The default handler would:
1. Detect `ProductArray` response type
2. Load `productRepository` dynamically
3. Query with `findAll({ featured: true, limit: 10, offset: 0 })` based on query params
4. Return results automatically

**Benefits:**
- No handler code needed for simple entity queries
- Declarative endpoint definitions
- Automatic repository integration
- Reduces boilerplate significantly

---

#### 3. Auto-Implemented Search in CRUD
**Priority: High | TIER 1**

Add configurable search functionality to CRUD endpoints that automatically implements search across specified fields.

**Current State:**
- CRUD GET list endpoints only support `limit` and `offset` query parameters
- No built-in search functionality
- Users must implement search manually in handlers

**Implementation:**
- Extend `CrudConfig` interface with search configuration:
  ```typescript
  export interface CrudConfig {
    // ... existing fields ...
    search?: {
      /**
       * Fields that can be searched (default: all string/text fields)
       * Can be array of field names or true to enable all searchable fields
       */
      fields?: string[] | true;
      
      /**
       * Search mode: "contains" (default), "starts", "ends", "exact"
       */
      mode?: "contains" | "starts" | "ends" | "exact";
      
      /**
       * Enable full-text search across multiple fields with a single query parameter
       */
      fullText?: boolean;
    };
  }
  ```
- Update `generateCrudEndpoints` to add `search` query parameter when search is enabled
- Enhance repository `findAll` method to support search across configured fields
- Support both individual field search and full-text search modes

**Example Configuration:**
```yaml
entities:
  Product:
    table: products
    crud:
      enabled: true
      search:
        fields: ["name", "description"]  # Only search these fields
        mode: "contains"  # Search mode: contains, starts, ends, or exact
        fullText: true    # Enable ?search=query parameter for multi-field search
    fields:
      id:
        type: uuid
        primary: true
        generated: true
      name:
        type: string
        required: true
      description:
        type: text
      price:
        type: number
```

**Generated Endpoints Would Support:**
- `GET /products?search=laptop` - Full-text search across name and description for "laptop"
- `GET /products?name=laptop` - Exact field matching (existing functionality)
- `GET /products?name=laptop&price=1000` - Multiple field filters (existing)
- `GET /products?limit=10&offset=0&search=laptop` - Combined search and pagination

**Search Modes:**
- `contains` (default): `ILIKE '%query%'` - matches anywhere in field
- `starts`: `ILIKE 'query%'` - matches at start of field
- `ends`: `ILIKE '%query'` - matches at end of field
- `exact`: `= 'query'` - exact match

**Benefits:**
- Zero-code search implementation
- Configurable search fields per entity
- Multiple search modes for flexibility
- Full-text search across multiple fields
- Consistent search patterns across all entities

---

#### 4. Basic Query Handler Type
**Priority: High | TIER 1**

Support built-in query handler type that can be configured directly in YAML without writing code.

**Implementation:**
Execute database queries directly from config:
```yaml
endpoints:
  - path: /products/search
    method: GET
    handler:
      type: query
      entity: Product
      filters:
        - field: name
          operator: ilike
          param: search
        - field: price
          operator: lte
          param: maxPrice
      pagination:
        limit: query.limit
        offset: query.offset
      orderBy:
        field: created_at
        direction: desc
    query:
      search:
        type: string
        required: false
      maxPrice:
        type: number
        required: false
    response:
      type: ProductArray
```

**Benefits:**
- No code required for common operations
- Faster development for simple endpoints
- Consistent query patterns

---

#### 5. Relation Handler Type
**Priority: Medium | TIER 4**

Access related entities:
```yaml
endpoints:
  - path: /products/:id/reviews
    method: GET
    handler:
      type: relation
      entity: Product
      relation: reviews
      parentId: params.id
    params:
      id:
        type: string
        required: true
    response:
      type: ReviewArray
```

---

#### 6. Aggregate Handler Type
**Priority: Medium | TIER 4**

Perform aggregations:
```yaml
endpoints:
  - path: /products/stats
    method: GET
    handler:
      type: aggregate
      entity: Product
      operations:
        - type: count
          alias: total
        - type: avg
          field: price
          alias: avgPrice
        - type: sum
          field: stock
          alias: totalStock
    response:
      type: ProductStats
```

---

#### 7. Handler Templates/Presets
**Priority: Medium | TIER 4**

Support configurable handler templates for common patterns.

**Template Types:**

##### CRUD Override Templates
Override specific CRUD operations with custom logic:
```yaml
entities:
  Product:
    table: products
    crud: true
    crudOverrides:
      POST:
        handler:
          type: template
          template: create-with-validation
          validate:
            - field: price
              min: 0
            - field: stock
              min: 0
```

##### Custom Templates
Define reusable handler templates:
```yaml
handlerTemplates:
  searchWithFilters:
    type: query
    filters: ${filters}
    pagination: true
    orderBy: ${orderBy}

endpoints:
  - path: /products/search
    method: GET
    handler:
      type: template
      template: searchWithFilters
      filters:
        - field: name
          operator: ilike
          param: q
      orderBy:
        field: created_at
        direction: desc
```

**Benefits:**
- Reusable handler patterns
- Consistent implementation across endpoints
- Easier maintenance

---

#### 8. Expression-Based Handlers
**Priority: Low | TIER 5**

Support SQL-like expressions or JavaScript expressions for simple transformations.

**SQL Expression Handler:**
```yaml
endpoints:
  - path: /stats
    method: GET
    handler:
      type: sql
      query: |
        SELECT 
          COUNT(*) as total_products,
          AVG(price) as avg_price,
          SUM(stock) as total_stock
        FROM products
        WHERE created_at > NOW() - INTERVAL '7 days'
    response:
      type: Stats
```

**JavaScript Expression Handler:**
```yaml
endpoints:
  - path: /products/:id/price-formatted
    method: GET
    handler:
      type: expression
      entity: Product
      expression: |
        const product = await context.entities.Product.findById(params.id);
        return {
          ...product,
          priceFormatted: `$${product.price.toFixed(2)}`
        };
    response:
      type: ProductWithFormattedPrice
```

**Benefits:**
- Quick transformations without full handler files
- SQL queries for complex aggregations
- JavaScript for simple data manipulation

---

## TIER 2: Production-Ready Plugins

### Current State
- ✅ Core plugin system with `YamaPlugin` interface
- ✅ Database plugins: PostgreSQL, PGLite
- ✅ HTTP server plugin: Fastify
- ✅ Storage plugins: Filesystem, S3
- ✅ Cache plugin: Redis
- ✅ Realtime plugin: WebSocket support
- ⚠️ Missing production-critical plugins: logging, metrics, error tracking, email, etc.

### Planned Production Plugins

#### 1. Observability & Monitoring Plugins

##### 1.1 Logging Plugin (`@betagors/yama-logging`)
**Priority: High | TIER 2**

Structured logging plugin with support for multiple logging libraries.

**Implementation:**
- Support for Winston, Pino, or Bunyan
- Configurable log levels, formatting, and transports
- Request/response logging middleware
- Access via `context.logger` in handlers
- Environment-based log configuration
- Log rotation and file management

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-logging":
    provider: pino  # or winston, bunyan
    level: info
    format: json
    transports:
      - type: console
      - type: file
        path: logs/app.log
    requestLogging: true
    responseLogging: true
```

**Usage:**
```typescript
export async function myHandler(context: HandlerContext) {
  context.logger.info('Processing request', { userId: context.auth.user?.id });
  context.logger.error('Something went wrong', { error });
  return result;
}
```

**Benefits:**
- Production-ready logging
- Structured logs for better analysis
- Multiple transport options
- Request/response correlation

---

##### 1.2 Metrics Plugin (`@betagors/yama-metrics`)
**Priority: High | TIER 2**

Metrics and telemetry plugin with Prometheus and OpenTelemetry support.

**Implementation:**
- Prometheus metrics endpoint (`/metrics`)
- OpenTelemetry integration
- Automatic request metrics (duration, count, errors)
- Custom metrics API
- Histogram and counter support
- Metric labels and tags

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-metrics":
    provider: prometheus  # or opentelemetry
    endpoint: /metrics
    enabled: true
    defaultMetrics: true  # Request duration, count, etc.
```

**Usage:**
```typescript
export async function myHandler(context: HandlerContext) {
  context.metrics?.increment('products.viewed', { productId: id });
  context.metrics?.histogram('request.duration', duration, { endpoint: '/products' });
  return result;
}
```

**Benefits:**
- Production monitoring
- Performance insights
- Alerting integration
- Standard metrics format

---

##### 1.3 Error Tracking Plugin (`@betagors/yama-error-tracking`)
**Priority: High | TIER 2**

Error tracking and aggregation plugin.

**Implementation:**
- Sentry integration
- Rollbar integration
- Automatic error capture
- Error aggregation and grouping
- Source map support
- Release tracking

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-error-tracking":
    provider: sentry  # or rollbar
    dsn: ${SENTRY_DSN}
    environment: production
    release: ${APP_VERSION}
    tracesSampleRate: 0.1
```

**Usage:**
```typescript
export async function myHandler(context: HandlerContext) {
  try {
    // ... code ...
  } catch (error) {
    context.errorTracking?.captureException(error, {
      extra: { userId: context.auth.user?.id }
    });
    throw error;
  }
}
```

**Benefits:**
- Production error monitoring
- Error aggregation
- Alerting integration
- Debugging context

---

##### 1.4 Tracing Plugin (`@betagors/yama-tracing`)
**Priority: Medium | TIER 2**

Distributed tracing plugin with OpenTelemetry support.

**Implementation:**
- OpenTelemetry integration
- Request tracing across services
- Performance profiling
- Trace context propagation
- Span creation and management

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-tracing":
    provider: opentelemetry
    serviceName: my-api
    exporter: jaeger  # or zipkin, otlp
    sampling: 0.1  # 10% sampling
```

**Usage:**
```typescript
export async function myHandler(context: HandlerContext) {
  const span = context.tracing?.startSpan('process-product');
  // ... work ...
  span?.end();
  return result;
}
```

**Benefits:**
- Distributed system visibility
- Performance debugging
- Request flow tracking
- Microservices support

---

#### 2. Security Plugin

##### 2.1 Security Plugin (`@betagors/yama-security`)
**Priority: High | TIER 2**

Security middleware and headers plugin.

**Implementation:**
- Helmet.js integration
- CORS configuration
- Security headers
- Request sanitization
- CSRF protection
- Rate limiting integration

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-security":
    helmet:
      enabled: true
      contentSecurityPolicy: true
    cors:
      origin: ${ALLOWED_ORIGINS}
      credentials: true
    csrf:
      enabled: true
      cookie: true
```

**Benefits:**
- Production security
- OWASP compliance
- Header protection
- CSRF prevention

---

#### 3. Email Service Plugins

##### 3.1 SendGrid Plugin (`@betagors/yama-email-sendgrid`)
**Priority: High | TIER 2**

SendGrid email service integration.

**Implementation:**
- SendGrid API integration
- Template support
- Attachment handling
- Batch sending
- Access via `context.email`

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-email-sendgrid":
    apiKey: ${SENDGRID_API_KEY}
    from: noreply@example.com
    templates:
      welcome: d-abc123
```

**Usage:**
```typescript
export async function myHandler(context: HandlerContext) {
  await context.email?.send({
    to: 'user@example.com',
    subject: 'Welcome',
    html: '<p>Welcome!</p>',
    // or
    template: 'welcome',
    templateData: { name: 'John' }
  });
}
```

---

##### 3.2 Resend Plugin (`@betagors/yama-email-resend`)
**Priority: High | TIER 2**

Resend email service integration.

**Implementation:**
- Resend API integration
- React email template support
- Domain verification
- Analytics integration

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-email-resend":
    apiKey: ${RESEND_API_KEY}
    from: noreply@example.com
```

---

##### 3.3 AWS SES Plugin (`@betagors/yama-email-ses`)
**Priority: Medium | TIER 2**

AWS Simple Email Service integration.

**Implementation:**
- AWS SES SDK integration
- Region configuration
- Template support
- Bounce/complaint handling

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-email-ses":
    region: us-east-1
    accessKeyId: ${AWS_ACCESS_KEY_ID}
    secretAccessKey: ${AWS_SECRET_ACCESS_KEY}
    from: noreply@example.com
```

---

##### 3.4 SMTP Plugin (`@betagors/yama-email-smtp`)
**Priority: Medium | TIER 2**

Generic SMTP email plugin.

**Implementation:**
- SMTP server connection
- TLS/SSL support
- Authentication support
- Multiple SMTP providers

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-email-smtp":
    host: smtp.example.com
    port: 587
    secure: false
    auth:
      user: ${SMTP_USER}
      pass: ${SMTP_PASSWORD}
    from: noreply@example.com
```

---

#### 4. Health Checks

##### 4.1 Health Plugin (`@betagors/yama-health`)
**Priority: Medium | TIER 2**

Enhanced health check and readiness/liveness endpoints.

**Implementation:**
- Database connectivity checks
- Cache connectivity checks
- External service health checks
- Readiness/liveness endpoints
- Health status aggregation
- Custom health checks

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-health":
    endpoint: /health
    checks:
      database: true
      cache: true
      storage: true
    customChecks:
      - name: external-api
        handler: checkExternalAPI
```

**Usage:**
```typescript
// Custom health check
export async function checkExternalAPI() {
  const response = await fetch('https://api.example.com/health');
  return response.ok;
}
```

**Benefits:**
- Kubernetes readiness/liveness
- Service monitoring
- Dependency health tracking
- Custom health logic

---

#### 5. Queue & Job Processing

##### 5.1 BullMQ Plugin (`@betagors/yama-queue-bullmq`)
**Priority: Medium | TIER 4**

BullMQ job queue integration.

**Implementation:**
- BullMQ integration
- Job creation and processing
- Queue management
- Worker support
- Access via `context.queue`

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-queue-bullmq":
    connection:
      host: ${REDIS_HOST}
      port: ${REDIS_PORT}
    queues:
      - name: emails
        concurrency: 5
      - name: notifications
        concurrency: 10
```

**Usage:**
```typescript
export async function myHandler(context: HandlerContext) {
  await context.queue?.add('emails', {
    to: 'user@example.com',
    subject: 'Welcome',
    template: 'welcome'
  });
  return { queued: true };
}
```

---

#### 6. Advanced Authentication

##### 6.1 OAuth Plugin (`@betagors/yama-auth-oauth`)
**Priority: Medium | TIER 4**

OAuth 2.0 provider integration (Google, GitHub, etc.).

**Implementation:**
- Multiple OAuth providers
- Authorization code flow
- Token management
- User profile retrieval
- Access via `context.auth.oauth`

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-auth-oauth":
    providers:
      google:
        clientId: ${GOOGLE_CLIENT_ID}
        clientSecret: ${GOOGLE_CLIENT_SECRET}
        redirectUri: ${GOOGLE_REDIRECT_URI}
      github:
        clientId: ${GITHUB_CLIENT_ID}
        clientSecret: ${GITHUB_CLIENT_SECRET}
        redirectUri: ${GITHUB_REDIRECT_URI}
```

---

#### 7. Additional Plugins (Lower Priority)

##### 7.1 Payment Processing
- `@betagors/yama-payments-stripe` - Stripe payments (Priority: Low | TIER 5)
- `@betagors/yama-payments-paypal` - PayPal payments (Priority: Low | TIER 5)

##### 7.2 Additional Auth Providers
- `@betagors/yama-auth-clerk` - Clerk authentication (Priority: Low | TIER 5)
- `@betagors/yama-auth-auth0` - Auth0 authentication (Priority: Low | TIER 5)
- `@betagors/yama-auth-supabase` - Supabase authentication (Priority: Low | TIER 5)

##### 7.3 Additional Queue Providers
- `@betagors/yama-queue-bull` - Bull queue (legacy) (Priority: Low | TIER 5)
- `@betagors/yama-queue-sqs` - AWS SQS queue (Priority: Low | TIER 5)

##### 7.4 Additional Database Adapters
- `@betagors/yama-mysql` - MySQL/MariaDB (Priority: Low | TIER 5)
- `@betagors/yama-sqlite` - SQLite (Priority: Low | TIER 5)

##### 7.5 Additional Cache Providers
- `@betagors/yama-cache-memcached` - Memcached (Priority: Low | TIER 5)
- `@betagors/yama-cache-cloudflare` - Cloudflare KV (Priority: Low | TIER 5)

---

## TIER 2.5: Deployment & Build System

### Current State
- ✅ Development server with `yama dev`
- ✅ Migration system for database changes
- ❌ No production build command
- ❌ No deployment tooling
- ❌ No platform-specific adapters
- ❌ No environment configuration management

### Planned Features

#### 1. Build System (`yama build`)
**Priority: High | TIER 2.5**

Production build command that compiles and optimizes YAMA projects for deployment.

**Implementation:**
- Compile TypeScript to JavaScript
- Bundle handlers and dependencies
- Generate optimized runtime bundles
- Prepare migrations for deployment
- Create deployment manifest
- Environment-specific builds
- Source map generation for debugging

**Example Usage:**
```bash
# Build for production
yama build --env production

# Build with specific output directory
yama build --out dist

# Build with optimizations
yama build --minify --tree-shake
```

**Build Output:**
```
dist/
  ├── handlers/          # Compiled handler files
  ├── migrations/        # Migration files ready for deployment
  ├── config/            # Processed configuration
  ├── manifest.json      # Deployment manifest
  └── package.json       # Production dependencies
```

**Benefits:**
- Production-ready builds
- Optimized bundle sizes
- Environment-specific configurations
- Migration preparation

---

#### 2. Deployment Targets & Adapters

##### 2.1 Serverless Deployment (Vercel/Netlify)
**Priority: High | TIER 2.5**

Deploy YAMA projects as serverless functions on Vercel or Netlify.

**Implementation:**
- `yama deploy --target vercel` command
- `yama deploy --target netlify` command
- Automatic function generation per handler
- Serverless-optimized bundling
- Environment variable management
- Automatic routing configuration

**Example Usage:**
```bash
# Deploy to Vercel
yama deploy --target vercel --env production

# Deploy to Netlify
yama deploy --target netlify --env production
```

**Configuration:**
```yaml
# yama.yaml
deployment:
  vercel:
    functions:
      memory: 1024
      maxDuration: 10
    env:
      DATABASE_URL: ${DATABASE_URL}
```

**Benefits:**
- Zero-config serverless deployment
- Automatic scaling
- Edge deployment support
- Cost-effective for low traffic

---

##### 2.2 AWS Lambda Deployment
**Priority: High | TIER 2.5**

Deploy YAMA projects as AWS Lambda functions.

**Implementation:**
- `yama deploy --target lambda` command
- Lambda-optimized bundling
- API Gateway integration
- Lambda layers for dependencies
- CloudFormation/SAM template generation
- IAM role configuration

**Example Usage:**
```bash
# Deploy to AWS Lambda
yama deploy --target lambda \
  --region us-east-1 \
  --function-name my-api \
  --env production
```

**Configuration:**
```yaml
# yama.yaml
deployment:
  lambda:
    region: us-east-1
    memory: 512
    timeout: 30
    layers:
      - arn:aws:lambda:us-east-1:123456789012:layer:postgres:1
```

**Benefits:**
- AWS-native deployment
- Automatic scaling
- Pay-per-use pricing
- Integration with AWS services

---

##### 2.3 Docker Container Deployment
**Priority: High | TIER 2.5**

Deploy YAMA projects as Docker containers.

**Implementation:**
- `yama deploy --target docker` command
- Dockerfile generation
- Multi-stage builds for optimization
- Health check configuration
- Environment variable support
- Docker Compose support

**Example Usage:**
```bash
# Build Docker image
yama deploy --target docker --build

# Deploy with Docker Compose
yama deploy --target docker --compose
```

**Generated Dockerfile:**
```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN yama build --env production

FROM node:20-alpine AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

**Benefits:**
- Portable deployments
- Consistent environments
- Kubernetes-ready
- Works with any container platform

---

##### 2.4 Cloudflare Workers Deployment
**Priority: Medium | TIER 2.5**

Deploy YAMA projects to Cloudflare Workers for edge computing.

**Implementation:**
- `yama deploy --target cloudflare` command
- Workers-optimized bundling
- Edge runtime compatibility
- KV/Durable Objects integration
- Automatic routing

**Example Usage:**
```bash
# Deploy to Cloudflare Workers
yama deploy --target cloudflare \
  --account-id YOUR_ACCOUNT_ID \
  --env production
```

**Benefits:**
- Global edge deployment
- Ultra-low latency
- Automatic DDoS protection
- Cost-effective

---

##### 2.5 Traditional Node.js Deployment
**Priority: Medium | TIER 2.5**

Deploy YAMA projects as traditional Node.js applications.

**Implementation:**
- `yama deploy --target node` command
- PM2 configuration generation
- Systemd service files
- Process management
- Health check endpoints

**Example Usage:**
```bash
# Generate PM2 config
yama deploy --target node --pm2

# Generate systemd service
yama deploy --target node --systemd
```

**Benefits:**
- Traditional VPS deployment
- Full control over runtime
- Long-running processes
- WebSocket support

---

#### 3. Environment Configuration Management
**Priority: High | TIER 2.5**

Manage environment-specific configurations for different deployment stages.

**Implementation:**
- Support for multiple environment files
- Environment variable validation
- Secret management integration
- Configuration merging
- Environment-specific `yama.yaml` overrides

**Example Structure:**
```
.
├── yama.yaml              # Base configuration
├── yama.dev.yaml          # Development overrides
├── yama.staging.yaml       # Staging overrides
├── yama.prod.yaml          # Production overrides
└── .env.example            # Environment variable template
```

**Example Usage:**
```bash
# Use environment-specific config
yama build --env production
yama deploy --env staging
```

**Configuration:**
```yaml
# yama.prod.yaml
database:
  connection:
    host: ${DB_HOST}
    port: ${DB_PORT}
    ssl: true

plugins:
  "@betagors/yama-logging":
    level: warn
    format: json
```

**Benefits:**
- Environment-specific settings
- Secure secret management
- Configuration validation
- Easy environment switching

---

#### 4. Database Migration Deployment
**Priority: High | TIER 2.5**

Automated database migration execution during deployment.

**Implementation:**
- Migration execution hooks in deployment process
- Rollback strategies
- Migration verification
- Pre-deployment migration checks
- Migration status tracking

**Example Usage:**
```bash
# Deploy with migrations
yama deploy --target vercel --run-migrations

# Check migration status
yama deploy --check-migrations

# Rollback migrations
yama deploy --rollback-migrations
```

**Configuration:**
```yaml
# yama.yaml
deployment:
  migrations:
    autoRun: true
    rollbackOnFailure: true
    verifyAfterRun: true
```

**Benefits:**
- Automated database updates
- Safe migration execution
- Rollback capabilities
- Migration tracking

---

#### 5. Deployment Health Checks
**Priority: Medium | TIER 2.5**

Built-in health check endpoints and deployment verification.

**Implementation:**
- Automatic health check endpoints (`/health`, `/ready`, `/live`)
- Post-deployment verification
- Smoke tests
- Deployment status reporting

**Example Usage:**
```bash
# Deploy with health checks
yama deploy --target vercel --health-check

# Run smoke tests after deployment
yama deploy --target vercel --smoke-tests
```

**Configuration:**
```yaml
# yama.yaml
deployment:
  healthChecks:
    enabled: true
    endpoint: /health
    timeout: 5000
    retries: 3
```

**Benefits:**
- Deployment verification
- Early failure detection
- Kubernetes readiness/liveness
- Monitoring integration

---

#### 6. CI/CD Integration
**Priority: Medium | TIER 2.5**

Templates and guides for CI/CD pipeline integration.

**Implementation:**
- GitHub Actions templates
- GitLab CI templates
- CircleCI templates
- Deployment workflow examples
- Environment promotion strategies

**Example GitHub Actions:**
```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: yama build --env production
      - run: yama deploy --target vercel --env production
```

**Benefits:**
- Automated deployments
- Consistent deployment process
- Environment promotion
- Reduced manual errors

---

#### 7. Deployment Adapter System
**Priority: Medium | TIER 2.5**

Plugin-based system for custom deployment targets.

**Implementation:**
- `YamaDeploymentAdapter` interface
- Custom adapter registration
- Adapter-specific configuration
- Community adapters support

**Example Adapter:**
```typescript
export class RailwayDeploymentAdapter implements YamaDeploymentAdapter {
  async deploy(config: DeploymentConfig): Promise<DeploymentResult> {
    // Railway-specific deployment logic
  }
}
```

**Benefits:**
- Extensible deployment system
- Community contributions
- Custom deployment targets
- Platform flexibility

---

## TIER 3: Microservices & Service Communication

### Current State
- ✅ Basic TypeScript SDK generation from `yama.yaml`
- ✅ Type-safe client generation
- ❌ No service discovery
- ❌ No inter-service communication
- ❌ No circuit breakers/retries
- ❌ No load balancing
- ❌ No service mesh integration

### Planned Features

#### 1. Service Client Generator (`@betagors/yama-service-client`)
**Priority: High | TIER 3**

Generate declarative, type-safe service clients (similar to OpenFeign) for inter-service communication.

**Implementation:**
- Generate type-safe service clients from service configurations
- Support for multiple service definitions
- Automatic request/response type mapping
- Access via `context.services` in handlers

**Example Configuration:**
```yaml
# yama.yaml
services:
  user-service:
    baseUrl: ${USER_SERVICE_URL}
    version: v1
    endpoints:
      - path: /users/:id
        method: GET
        response:
          type: User
      - path: /users
        method: POST
        body:
          type: CreateUserInput
        response:
          type: User

  payment-service:
    baseUrl: ${PAYMENT_SERVICE_URL}
    version: v1
    endpoints:
      - path: /payments
        method: POST
        body:
          type: CreatePaymentInput
        response:
          type: Payment
```

**Generated Client Usage:**
```typescript
// Auto-generated service client
import { userService, paymentService } from '@gen/services';

// In your handler
export async function createOrder(context: HandlerContext) {
  // Type-safe service calls
  const user = await userService.getUser({ id: userId });
  const payment = await paymentService.createPayment({
    amount: 1000,
    userId: user.id
  });
  
  return { user, payment };
}
```

**Benefits:**
- Type-safe inter-service communication
- Declarative service definitions
- Automatic code generation
- Consistent API across services

---

#### 2. Service Discovery (`@betagors/yama-service-discovery`)
**Priority: High | TIER 3**

Support multiple service discovery mechanisms for dynamic service resolution.

**Implementation:**
- Support for Consul, Kubernetes, Eureka, etcd, static configuration
- Automatic service registration
- Health check integration
- Service instance selection

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-service-discovery":
    provider: consul  # or kubernetes, eureka, etcd, static
    config:
      host: ${CONSUL_HOST}
      port: 8500
    
services:
  user-service:
    discovery:
      name: user-service
      tags: [api, v1]
      healthCheck: /health
```

**Benefits:**
- Dynamic service resolution
- Automatic failover
- Service mesh integration
- Kubernetes-native support

---

#### 3. Resilience Plugin (`@betagors/yama-resilience`)
**Priority: High | TIER 3**

Circuit breakers, retries, timeouts, and load balancing for service calls.

**Implementation:**
- Circuit breaker pattern
- Automatic retries with backoff strategies
- Request timeouts
- Load balancing strategies (round-robin, random, weighted)
- Failure tracking and metrics

**Example Configuration:**
```yaml
services:
  payment-service:
    baseUrl: ${PAYMENT_SERVICE_URL}
    resilience:
      circuitBreaker:
        enabled: true
        failureThreshold: 5
        timeout: 10000
        resetTimeout: 30000
      retry:
        enabled: true
        maxAttempts: 3
        backoff: exponential
        initialDelay: 100
      timeout: 5000
      loadBalancer:
        strategy: round-robin  # or random, weighted
```

**Usage:**
```typescript
export async function myHandler(context: HandlerContext) {
  // Automatic retries, circuit breaker, load balancing
  const result = await context.services.paymentService.createPayment({
    amount: 1000
  });
  return result;
}
```

**Benefits:**
- Prevents cascade failures
- Automatic recovery
- Better reliability
- Production-ready microservices

---

#### 4. Service Registry
**Priority: Medium | TIER 3**

Centralized service registry for managing service definitions and dependencies.

**Example Configuration:**
```yaml
# yama-registry.yaml (shared)
services:
  user-service:
    baseUrl: http://user-service:3000
    version: v1
    healthCheck: /health
    tags: [core, api]
    
  order-service:
    baseUrl: http://order-service:3000
    version: v1
    healthCheck: /health
    tags: [core, api]
```

**Benefits:**
- Centralized service management
- Version control for service contracts
- Dependency tracking
- Service graph visualization

---

#### 5. Service Mesh Integration (`@betagors/yama-service-mesh`)
**Priority: Low | TIER 5**

Integration with service mesh solutions (Istio, Linkerd, Consul Connect).

**Example Configuration:**
```yaml
plugins:
  "@betagors/yama-service-mesh":
    provider: istio  # or linkerd, consul-connect
    config:
      enabled: true
      mTLS: true
      tracing: true
```

**Benefits:**
- Advanced traffic management
- mTLS encryption
- Observability integration
- Policy enforcement

---

## TIER 4: Plugin Ecosystem Development

### Current State
- ✅ Plugin system with `YamaPlugin` interface
- ✅ Plugin loading from npm packages
- ✅ Plugin registry and validation
- ✅ CLI commands: `yama plugin install`, `yama plugin list`, `yama plugin validate`
- ⚠️ No plugin creation guide or templates
- ⚠️ No plugin discovery/search mechanism
- ⚠️ No official plugin registry or marketplace
- ⚠️ Limited documentation for plugin developers

### Planned Features

#### 1. Plugin Creation Guide & Templates
**Priority: High | TIER 4**

Create comprehensive documentation and tooling to help users build their own plugins.

**Implementation:**
- Create `docs/plugins/creating-plugins.md` with:
  - Step-by-step plugin creation guide
  - Plugin interface documentation
  - Examples for different plugin types (database, HTTP, services)
  - Best practices and conventions
- Add `yama plugin create <name>` command that:
  - Generates plugin scaffold with proper structure
  - Includes TypeScript setup, build configuration
  - Provides template based on plugin category
  - Sets up testing framework
- Create plugin templates for common categories:
  - Database adapter plugin
  - HTTP server plugin
  - Service integration plugin (payments, email, etc.)

**Example Usage:**
```bash
yama plugin create my-database-plugin --category database
# Creates:
# - my-database-plugin/
#   - src/
#     - plugin.ts (template)
#     - adapter.ts (if database)
#   - package.json (with yama metadata)
#   - tsconfig.json
#   - README.md
```

**Benefits:**
- Lowers barrier to entry for plugin development
- Ensures consistent plugin structure
- Reduces boilerplate and setup time
- Encourages community plugin development

---

#### 2. Plugin Discovery & Search
**Priority: High | TIER 4**

Enable users to discover and search for available plugins.

**Implementation:**
- Add `yama plugin search <query>` command:
  - Searches npm registry for packages with `yama` keyword
  - Filters by `yama` metadata in package.json
  - Displays plugin information (name, version, category, description)
  - Shows installation instructions
- Add `yama plugin browse` command:
  - Lists plugins by category
  - Shows official vs community plugins
  - Displays plugin popularity/usage metrics (if available)
- Enhance `yama plugin list` to show:
  - Plugin status (installed, outdated, compatible)
  - Plugin metadata (category, version, description)
  - Update availability

**Example Usage:**
```bash
# Search for database plugins
yama plugin search database

# Browse all available plugins
yama plugin browse

# Browse by category
yama plugin browse --category database
```

**Benefits:**
- Makes plugin discovery easy
- Helps users find the right plugin for their needs
- Encourages plugin adoption
- Increases visibility for community plugins

---

#### 3. Plugin Documentation & Examples
**Priority: Medium | TIER 4**

Comprehensive documentation for plugin developers and users.

**Implementation:**
- Create `docs/plugins/` directory with:
  - `creating-plugins.md` - Plugin development guide
  - `plugin-api.md` - Plugin API reference
  - `examples/` - Example plugins for different use cases
  - `registry.md` - Official and community plugins list
  - `best-practices.md` - Plugin development best practices
- Add plugin examples:
  - Database adapter example
  - HTTP server adapter example
  - Payment service integration example
  - Email service integration example
- Create plugin showcase page:
  - Featured plugins
  - Popular plugins
  - Recently added plugins
  - Plugin categories

**Benefits:**
- Better developer experience
- Clear guidelines and examples
- Reduced support burden
- Higher quality plugins

---

#### 4. Plugin Registry System
**Priority: Medium | TIER 4**

Create a centralized registry for official and community plugins.

**Implementation:**
- Create registry JSON file or API endpoint
- Host registry at `registry.yama.dev` or in repository
- Add `yama plugin registry` command to:
  - Fetch and display registry contents
  - Show plugin details from registry
  - Install plugins from registry
- Create submission process for community plugins:
  - GitHub issue template for plugin submissions
  - Review process for official listing
  - Verification badges for tested plugins

**Benefits:**
- Centralized source of truth for available plugins
- Quality control through verification
- Better discoverability
- Community engagement

---

#### 5. Plugin Validation & Testing Tools
**Priority: Medium | TIER 4**

Tools to help plugin developers validate and test their plugins.

**Implementation:**
- Enhance `yama plugin validate` to:
  - Check plugin structure and interface compliance
  - Validate plugin metadata
  - Test plugin initialization
  - Verify version compatibility
  - Run plugin-specific tests
- Add `yama plugin test` command:
  - Run plugin test suite
  - Validate against Yama core versions
  - Check for common issues
- Create plugin testing utilities:
  - Mock Yama context for testing
  - Plugin test helpers
  - Integration test templates
- Add CI/CD templates for plugins:
  - GitHub Actions workflow
  - Automated testing on Yama version updates
  - Automated publishing

**Benefits:**
- Ensures plugin quality
- Catches issues early
- Reduces compatibility problems
- Professional plugin development workflow

---

#### 6. Plugin Versioning & Compatibility
**Priority: Medium | TIER 4**

Better version management and compatibility checking.

**Implementation:**
- Enhance plugin version validation:
  - Check `yamaCore` compatibility range
  - Validate `pluginApi` version
  - Warn about incompatible versions
  - Suggest compatible alternatives
- Add `yama plugin check-updates` command:
  - Check for plugin updates
  - Show compatibility with current Yama version
  - Suggest update paths
- Create plugin compatibility matrix:
  - Track plugin compatibility across Yama versions
  - Document breaking changes
  - Migration guides for plugin updates
- Add plugin deprecation system:
  - Mark plugins as deprecated
  - Suggest alternatives
  - Show deprecation timeline

**Benefits:**
- Prevents compatibility issues
- Easier plugin maintenance
- Better upgrade experience
- Clear migration paths

---

#### 7. Plugin Marketplace (Web Interface)
**Priority: Low | TIER 5**

Web-based plugin directory and marketplace.

**Implementation:**
- Create web interface at `plugins.yama.dev`:
  - Browse plugins by category
  - Search and filter plugins
  - View plugin details, documentation, and examples
  - Plugin ratings and reviews
  - Installation instructions
- Features:
  - Plugin badges (official, verified, community)
  - Download statistics
  - Version history
  - Compatibility matrix
  - Plugin dependencies
  - Screenshots/demos
- Integration with CLI:
  - `yama plugin open <name>` - Opens plugin page in browser
  - `yama plugin info <name>` - Shows detailed plugin information

**Benefits:**
- Better user experience for plugin discovery
- Visual plugin browsing
- Community engagement
- Plugin promotion

---

## Implementation Priority Summary

### TIER 1: Foundation & Core DX (Do First)
**Timeline: Months 1-2**

1. Database access in handler context
2. Smart default handlers for entity endpoints
3. Auto-implemented search in CRUD
4. Basic query handler type

**Why First:** These enable everything else and provide immediate developer experience improvements.

---

### TIER 2: Production Essentials (Critical Path)
**Timeline: Months 3-4**

1. `@betagors/yama-logging` - Structured logging plugin
2. `@betagors/yama-metrics` - Metrics and telemetry plugin
3. `@betagors/yama-error-tracking` - Error tracking plugin
4. `@betagors/yama-security` - Security middleware plugin
5. `@betagors/yama-email-sendgrid` or `@betagors/yama-email-resend` - Email service plugin
6. `@betagors/yama-health` - Enhanced health checks

**Why Second:** Required for any production deployment. These are non-negotiable for real-world usage.

---

### TIER 2.5: Deployment & Build System (Production Readiness)
**Timeline: Months 4-5**

1. Build System (`yama build`) - Production build command
2. Serverless Deployment (Vercel/Netlify) - Zero-config serverless deployment
3. AWS Lambda Deployment - Lambda function deployment
4. Docker Container Deployment - Container-based deployment
5. Environment Configuration Management - Multi-environment support
6. Database Migration Deployment - Automated migration execution
7. Deployment Health Checks - Post-deployment verification

**Why 2.5:** Enables actual production deployments. Critical for moving from development to production. Should be developed in parallel with TIER 2 plugins.

---

### TIER 3: Microservices & Inter-Service Communication (High Value)
**Timeline: Months 5-6**

1. Service Client Generator (`@betagors/yama-service-client`)
2. Service Discovery (`@betagors/yama-service-discovery`)
3. Resilience Plugin (`@betagors/yama-resilience`)
4. Service Registry

**Why Third:** Unlocks microservices architecture and enterprise use cases. High strategic value.

---

### TIER 4: Enhanced Developer Experience
**Timeline: Months 7-8**

1. Plugin Creation Guide & Templates
2. Plugin Discovery & Search
3. Plugin Documentation & Examples
4. Relation handler type
5. Aggregate handler type
6. Handler templates
7. `@betagors/yama-queue-bullmq` - Job queue processing
8. `@betagors/yama-auth-oauth` - OAuth authentication

**Why Fourth:** Improves productivity and adoption. Enables community growth.

---

### TIER 5: Advanced Features & Nice-to-Have
**Timeline: Months 9+**

1. `@betagors/yama-tracing` - Distributed tracing
2. `@betagors/yama-email-ses` - AWS SES email plugin
3. `@betagors/yama-email-smtp` - Generic SMTP plugin
4. Payment plugins (Stripe, PayPal)
5. Additional auth providers (Clerk, Auth0, Supabase)
6. Additional database adapters (MySQL, SQLite)
7. Additional cache providers (Memcached, Cloudflare KV)
8. Expression-based handlers
9. Plugin Registry System
10. Plugin Validation & Testing Tools
11. Plugin Versioning & Compatibility
12. Plugin Marketplace (Web Interface)
13. Service Mesh Integration

**Why Last:** Nice-to-haves that can be community-driven or built later.

---

## Related Features

### Schema Enhancements
- Support for computed fields in schemas
- Virtual fields that are calculated at runtime
- Field-level validation rules

### Validation Enhancements
- Custom validation functions in config
- Cross-field validation
- Conditional validation rules

### Documentation
- Auto-generate handler documentation from config
- Examples for each handler type
- Migration guide from code-based to config-based handlers
- Plugin development guides and API reference
- Plugin registry and marketplace documentation

### Plugin Ecosystem
- Plugin creation templates and scaffolding
- Plugin discovery and search capabilities
- Official and community plugin registry
- Plugin validation and testing tools
- Plugin versioning and compatibility management
- Production-ready plugins (logging, metrics, error tracking, email, payments, etc.)
- Observability plugins (tracing, health checks, monitoring)
- Security plugins (CORS, CSRF, headers)
- Queue and job processing plugins
- Microservices plugins (service clients, discovery, resilience)

### Deployment & Infrastructure
- Production build system with optimization
- Multi-platform deployment support (serverless, containers, traditional)
- Environment configuration management
- Automated database migration deployment
- CI/CD integration templates
- Deployment health checks and verification
- Platform-specific adapters (Vercel, Netlify, AWS Lambda, Docker, Cloudflare Workers)
- Deployment adapter system for custom targets

## Notes

- All features should maintain backward compatibility with existing TypeScript handlers
- Custom handlers will always be supported for complex business logic
- Config-based handlers should be optional, not required
- Performance should be considered for all new handler types
- Microservices features should integrate seamlessly with existing YAMA architecture
- Service clients should be generated from service definitions, similar to how SDKs are generated from endpoints
