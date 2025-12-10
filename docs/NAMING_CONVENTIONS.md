# Yama Package Naming Conventions

This document defines the naming conventions for all Yama packages to ensure consistency, clarity, and discoverability.

## Package Name Format

All Yama packages follow the format:

```
@betagors/yama-{descriptor}
```

Where `{descriptor}` is a **single word** or **compound word** (no hyphens after `yama-`).

## Naming Categories

### 1. Core Concepts

For packages that represent core Yama concepts or features:

```
yama-{concept}
```

| Package | Description |
|---------|-------------|
| `yama-core` | Core runtime, types, and utilities |
| `yama-cli` | Command-line interface |
| `yama-errors` | Error handling and error types |
| `yama-security` | Security middleware (CORS, CSRF, headers) |
| `yama-logging` | Structured logging |
| `yama-metrics` | Metrics and telemetry |
| `yama-health` | Health checks |
| `yama-realtime` | WebSocket and real-time features |
| `yama-session` | Session management |

### 2. Protocols & Standards

For packages that implement standard protocols:

```
yama-{protocol}
```

| Package | Description |
|---------|-------------|
| `yama-smtp` | SMTP email protocol |
| `yama-oauth` | OAuth 2.0 / OpenID Connect |
| `yama-saml` | SAML 2.0 authentication |
| `yama-ldap` | LDAP directory protocol |

### 3. Technologies & Databases

For packages that integrate with specific technologies:

```
yama-{technology}
```

| Package | Description |
|---------|-------------|
| `yama-postgres` | PostgreSQL database adapter |
| `yama-pglite` | PGLite (embedded Postgres) adapter |
| `yama-redis` | Redis cache/store adapter |
| `yama-fastify` | Fastify HTTP server adapter |

### 4. Cloud Services (Unique Names)

When a cloud service has a **globally unique and well-known name**, use it directly:

```
yama-{service-name}
```

| Package | Description |
|---------|-------------|
| `yama-s3` | AWS S3 storage |
| `yama-ses` | AWS SES email |
| `yama-cognito` | AWS Cognito authentication |
| `yama-r2` | Cloudflare R2 storage |
| `yama-d1` | Cloudflare D1 database |
| `yama-firestore` | Firebase Firestore |
| `yama-clerk` | Clerk authentication |
| `yama-auth0` | Auth0 authentication |
| `yama-stytch` | Stytch authentication |
| `yama-workos` | WorkOS SSO |

### 5. Cloud Services (Generic Names)

When a vendor offers a service with a **generic name** (auth, storage, database), use an abbreviated vendor prefix as a compound word:

```
yama-{vendor-abbrev}{service}
```

#### Supabase Services
| Package | Description |
|---------|-------------|
| `yama-supaauth` | Supabase Auth |
| `yama-supastorage` | Supabase Storage |
| `yama-supaedge` | Supabase Edge Functions |
| `yama-supavectors` | Supabase Vectors |

#### Firebase Services
| Package | Description |
|---------|-------------|
| `yama-fireauth` | Firebase Authentication |
| `yama-firestorage` | Firebase Storage |
| `yama-firefunctions` | Firebase Functions |

#### Cloudflare Services (with generic names)
| Package | Description |
|---------|-------------|
| `yama-cfkv` | Cloudflare KV |
| `yama-cfworkers` | Cloudflare Workers |
| `yama-cfai` | Cloudflare AI |

### 6. Features & Capabilities

For packages that add specific features:

```
yama-{feature}
```

| Package | Description |
|---------|-------------|
| `yama-mfa` | Multi-factor authentication |
| `yama-passkeys` | WebAuthn / FIDO2 / Passkeys |
| `yama-sdk` | SDK generator |
| `yama-openapi` | OpenAPI documentation generator |

## Decision Tree

Use this flowchart to determine the correct package name:

```
Is it a core Yama concept?
├─ YES → yama-{concept}
│        Examples: yama-core, yama-session, yama-security
│
└─ NO
   │
   Is it a standard protocol?
   ├─ YES → yama-{protocol}
   │        Examples: yama-oauth, yama-smtp, yama-saml
   │
   └─ NO
      │
      Is it a specific technology/database?
      ├─ YES → yama-{technology}
      │        Examples: yama-postgres, yama-redis, yama-fastify
      │
      └─ NO (it's a cloud service)
         │
         Does the service have a globally unique name?
         ├─ YES → yama-{service}
         │        Examples: yama-s3, yama-cognito, yama-clerk
         │
         └─ NO (generic name like "auth", "storage")
            │
            └─ yama-{vendor-abbrev}{service}
               Examples: yama-supaauth, yama-fireauth, yama-supastorage
```

## Vendor Abbreviations

When a vendor prefix is needed, use these standard abbreviations:

| Vendor | Abbreviation | Example |
|--------|--------------|---------|
| Supabase | `supa` | `yama-supaauth` |
| Firebase | `fire` | `yama-fireauth` |
| Cloudflare | `cf` | `yama-cfkv` |
| AWS | `aws` | `yama-awsauth` (if needed) |

> **Note:** For AWS services, prefer the unique service name (e.g., `yama-cognito`, `yama-s3`) over prefixed names.

## Examples

### Good Names ✅

```
yama-postgres       # Technology
yama-oauth          # Protocol
yama-session        # Core concept
yama-cognito        # Unique AWS service name
yama-supaauth       # Supabase Auth (generic service + vendor prefix)
yama-firestore      # Unique Firebase service name
yama-mfa            # Feature
```

### Bad Names ❌

```
yama-supabase       # Too vague - which Supabase service?
yama-firebase       # Too vague - which Firebase service?
yama-aws            # Too vague - which AWS service?
yama-auth-oauth     # Don't use hyphens after yama-
yama-supabase-auth  # Don't use hyphens after yama-
yama-OAuth          # Don't use capitals (npm convention)
```

## Plugin Configuration Example

Following these conventions, a typical Yama configuration looks clean and consistent:

```yaml
plugins:
  # Databases
  "@betagors/yama-postgres":
    connectionString: ${DATABASE_URL}
  
  # Caching
  "@betagors/yama-redis":
    url: ${REDIS_URL}
  
  # Authentication
  "@betagors/yama-oauth":
    providers:
      google: { clientId: ${GOOGLE_ID}, clientSecret: ${GOOGLE_SECRET} }
      github: { clientId: ${GITHUB_ID}, clientSecret: ${GITHUB_SECRET} }
  
  "@betagors/yama-session":
    store: redis
    cookie: { secure: true, httpOnly: true }
  
  "@betagors/yama-mfa":
    methods: [totp, sms]
  
  # Vendor services
  "@betagors/yama-supaauth":
    url: ${SUPABASE_URL}
    anonKey: ${SUPABASE_ANON_KEY}
  
  # Storage
  "@betagors/yama-s3":
    bucket: my-bucket
    region: us-east-1
  
  # Observability
  "@betagors/yama-logging":
    level: info
    format: json
  
  "@betagors/yama-metrics":
    endpoint: /metrics
```

## Creating a New Package

When creating a new Yama package:

1. **Determine the category** using the decision tree above
2. **Choose the name** following the appropriate pattern
3. **Check for uniqueness** - ensure no existing package has a similar name
4. **Update this document** if adding a new category or vendor abbreviation

## Rationale

This naming convention:

- **Maintains consistency** across all packages
- **Improves discoverability** - users can predict package names
- **Avoids ambiguity** - vendor+service combinations are clear
- **Follows npm conventions** - lowercase, hyphenated after scope
- **Stays AI-friendly** - predictable patterns help AI tools generate correct configurations
