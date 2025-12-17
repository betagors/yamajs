# Yama v1.0 Provider System - Implementation Plan

## Summary

Implement a new **Provider System** for Yama v1.0 with **7 core built-in providers** that work out of the box with zero external dependencies.

## Status: ✅ PHASE 1, 2 & 3 (Partial) COMPLETE

### Completed Work
- ✅ Phase 1: Core Infrastructure (types, registry, context)
- ✅ Phase 2.1: Config Provider (env adapter)
- ✅ Phase 2.2: Logging Provider (console adapter)
- ✅ Phase 2.3: Database Provider (pglite adapter)
- ✅ Phase 2.4: Cache Provider (memory adapter)
- ✅ Phase 2.5: Email Provider (smtp adapter)
- ✅ Phase 2.6: Auth Provider (jwt-password adapter)
- ✅ Phase 2.7: Storage Provider (local adapter)
- ✅ Phase 3.1: Configuration Parsing (providers: block in yama.yaml)
- ✅ Phase 3.2: Handler Context Integration (createRequestContext, auth middleware)

### Remaining Work
- ⏳ Phase 3.3: CLI Integration (dev/start commands)
- ⏳ Phase 3.4: Email UI (/__yama/emails route)
- ⏳ Phase 4: Testing
- ⏳ Phase 5: Documentation


---

## The 7 Core Providers

| Provider | Adapter | Purpose |
|----------|---------|---------|
| **config** | env | Environment variables, .env files |
| **logging** | console | Logging with pretty/json formats |
| **database** | pglite | SQL database (Postgres-compatible) |
| **cache** | memory | In-memory caching |
| **email** | smtp | Email sending (used by auth) |
| **auth** | jwt-password | Authentication & authorization |
| **storage** | local | File storage |

---

## Phase 1: Core Infrastructure

### Task 1.1: Provider Types and Interfaces
**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Files:**
- `packages/core/src/providers/types.ts` (NEW)

**Work:**
- [ ] Define `Provider` interface
- [ ] Define `ProviderContext` interface
- [ ] Define `ProviderFactory` type
- [ ] Define config types for all 7 providers
- [ ] Define API types for all 7 providers

---

### Task 1.2: Provider Registry
**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Files:**
- `packages/core/src/providers/registry.ts` (NEW)

**Work:**
- [ ] Create `ProviderRegistry` class
- [ ] Implement `registerAdapter()` method
- [ ] Implement `getAdapter()` method
- [ ] Implement `initializeAll()` with correct ordering:
  1. config → 2. logging → 3. database → 4. cache → 5. email → 6. auth → 7. storage
- [ ] Implement `shutdownAll()` with reverse ordering
- [ ] Handle provider dependencies

---

### Task 1.3: Provider Context
**Status:** ⏳ Pending  
**Priority:** 🔴 Critical  
**Files:**
- `packages/core/src/providers/context.ts` (NEW)

**Work:**
- [ ] Create `ProviderContext` implementation
- [ ] Implement `getProvider()` method
- [ ] Implement `getConfig()` method
- [ ] Bootstrap config and logging before other providers

---

## Phase 2: Built-in Adapters

### Task 2.1: Config Provider (ENV Adapter)
**Status:** ⏳ Pending  
**Priority:** 🔴 First (other providers depend on this)  
**Estimated:** 4 hours  
**Files:**
- `packages/core/src/providers/config/types.ts` (NEW)
- `packages/core/src/providers/config/index.ts` (NEW)
- `packages/core/src/providers/config/adapters/env.ts` (NEW)

**Work:**
- [ ] Create `ConfigProviderConfig` interface
- [ ] Create `ConfigAPI` interface
- [ ] Implement env adapter:
  - [ ] Load .env file (using built-in dotenv parsing)
  - [ ] Load .env.local (override)
  - [ ] Load .env.{NODE_ENV}
  - [ ] Merge with process.env
- [ ] Implement `get()`, `getRequired()`, `has()` methods
- [ ] Implement `${VAR:default}` substitution helper
- [ ] Add `isDev`, `isProd`, `env` properties

---

### Task 2.2: Logging Provider (Console Adapter)
**Status:** ⏳ Pending  
**Priority:** 🔴 Second (every provider uses logging)  
**Estimated:** 4 hours  
**Files:**
- `packages/core/src/providers/logging/types.ts` (NEW)
- `packages/core/src/providers/logging/index.ts` (NEW)
- `packages/core/src/providers/logging/adapters/console.ts` (NEW)

**Work:**
- [ ] Create `LoggingProviderConfig` interface
- [ ] Create `LoggerAPI` interface
- [ ] Implement console adapter:
  - [ ] Support log levels (debug, info, warn, error)
  - [ ] Support pretty format (colored, human-readable)
  - [ ] Support json format (structured, production)
  - [ ] Auto-detect pretty vs json based on NODE_ENV
- [ ] Implement `child()` for contextual logging
- [ ] Integrate with existing `@yamajs/logging` package

---

### Task 2.3: Database Provider (PGLite Adapter)
**Status:** ⏳ Pending  
**Priority:** 🟡 Third  
**Estimated:** 6 hours  
**Files:**
- `packages/core/src/providers/database/types.ts` (NEW)
- `packages/core/src/providers/database/index.ts` (NEW)
- `packages/core/src/providers/database/adapters/pglite.ts` (NEW)

**Work:**
- [ ] Create `DatabaseProviderConfig` interface
- [ ] Create `DatabaseAPI` interface
- [ ] Implement pglite adapter:
  - [ ] Initialize PGLite with path or memory mode
  - [ ] Implement `query()`, `queryOne()`, `execute()`
  - [ ] Implement `transaction()` support
  - [ ] Implement `sql` template tag
- [ ] Integrate with existing `@yamajs/pglite` package
- [ ] Ensure migrations work with new provider system

---

### Task 2.4: Cache Provider (Memory Adapter)
**Status:** ⏳ Pending  
**Priority:** 🟡 Fourth  
**Estimated:** 4 hours  
**Files:**
- `packages/core/src/providers/cache/types.ts` (NEW)
- `packages/core/src/providers/cache/index.ts` (NEW)
- `packages/core/src/providers/cache/adapters/memory.ts` (NEW)

**Work:**
- [ ] Create `CacheProviderConfig` interface
- [ ] Create `CacheAPI` interface
- [ ] Implement memory adapter:
  - [ ] LRU cache with configurable max size
  - [ ] TTL support with automatic expiration
  - [ ] Implement `get()`, `set()`, `del()`, `exists()`
  - [ ] Implement `mget()`, `mset()` for bulk operations
  - [ ] Implement `getOrSet()` for cache-aside pattern
  - [ ] Implement `namespace()` for prefixed caches
  - [ ] Implement `clear()`
- [ ] Integrate with existing `@yamajs/cache` package if applicable

---

### Task 2.5: Email Provider (SMTP Adapter)
**Status:** ⏳ Pending  
**Priority:** 🔴 Fifth (Auth depends on this)  
**Estimated:** 8 hours  
**Files:**
- `packages/core/src/providers/email/types.ts` (NEW)
- `packages/core/src/providers/email/index.ts` (NEW)
- `packages/core/src/providers/email/adapters/smtp.ts` (NEW)
- `packages/core/src/providers/email/templates/` (NEW - directory)
  - `verify-link.html`
  - `verify-code.html`
  - `password-reset.html`
  - `password-reset-code.html`
  - `welcome.html`
  - `account-locked.html`
- `packages/core/src/providers/email/capture.ts` (NEW - dev mode)
- `packages/core/src/providers/email/ui.ts` (NEW - /__yama/emails UI)

**Work:**
- [ ] Create `EmailProviderConfig` interface
- [ ] Create `EmailAPI` interface
- [ ] Implement SMTP adapter:
  - [ ] Use Node.js built-in `net` module for SMTP (or minimal wrapper)
  - [ ] Support TLS/SSL connections
  - [ ] Support authentication (PLAIN, LOGIN)
  - [ ] Implement `send()` and `sendTemplate()`
- [ ] Implement dev capture mode:
  - [ ] Save emails to `.yama/emails/` as JSON
  - [ ] Log to console with extracted links
  - [ ] Auto-enable when no SMTP configured
- [ ] Create `/__yama/emails` UI:
  - [ ] Inbox list with search
  - [ ] HTML email preview
  - [ ] Link extraction
- [ ] Create built-in email templates:
  - [ ] Beautiful, responsive HTML
  - [ ] Support `{{variable}}` placeholders
  - [ ] Plain text fallback
- [ ] Implement template overrides (custom templates from `./emails/`)

---

### Task 2.6: Auth Provider (JWT + Password Adapter)
**Status:** ⏳ Pending  
**Priority:** 🔴 Sixth  
**Estimated:** 16 hours  
**Files:**
- `packages/core/src/providers/auth/types.ts` (NEW)
- `packages/core/src/providers/auth/index.ts` (NEW)
- `packages/core/src/providers/auth/adapters/jwt-password.ts` (NEW)
- `packages/core/src/providers/auth/directives.ts` (NEW)
- `packages/core/src/providers/auth/middleware.ts` (NEW)
- `packages/core/src/providers/auth/password.ts` (NEW)
- `packages/core/src/providers/auth/rate-limit.ts` (NEW)
- `packages/core/src/providers/auth/lockout.ts` (NEW)
- `packages/core/src/providers/auth/sessions.ts` (NEW)
- `packages/core/src/providers/auth/endpoints.ts` (NEW)

**Work:**

#### Core Auth System
- [ ] Create `AuthProviderConfig` interface (comprehensive)
- [ ] Create `AuthAPI` interface
- [ ] Implement JWT handling:
  - [ ] Use Node.js built-in `crypto` for JWT (no jsonwebtoken dependency)
  - [ ] Implement `createAccessToken()`, `verifyAccessToken()`
  - [ ] Short-lived access tokens (15m default)
  - [ ] Support custom claims

#### Refresh Tokens (CRITICAL)
- [ ] Implement refresh token system:
  - [ ] Store in database (for revocation)
  - [ ] `createRefreshToken()`, `verifyRefreshToken()`
  - [ ] `refreshTokens()` - get new token pair
  - [ ] `revokeRefreshToken()`, `revokeAllUserTokens()`
  - [ ] Token rotation on each refresh
  - [ ] Max tokens per user limit

#### Password Management (CRITICAL)
- [ ] Implement password hashing:
  - [ ] Use Node.js built-in `crypto.scrypt` (no bcrypt dependency)
  - [ ] Argon2id-like security with scrypt
  - [ ] `hashPassword()`, `verifyPassword()`
- [ ] Implement password validation:
  - [ ] Min/max length
  - [ ] Character requirements (upper, lower, number, special)
  - [ ] Common password denial (built-in list)
  - [ ] Breach checking (haveibeenpwned API)
  - [ ] Password strength scoring

#### Rate Limiting (CRITICAL)
- [ ] Implement rate limiting:
  - [ ] Per-action limits (login, signup, reset, verify)
  - [ ] Configurable window and max attempts
  - [ ] Block duration after limit exceeded
  - [ ] `checkRateLimit()` method
  - [ ] Use cache provider for storage

#### Account Lockout (CRITICAL)
- [ ] Implement account lockout:
  - [ ] Track failed login attempts
  - [ ] Lock after max attempts
  - [ ] Configurable duration
  - [ ] Email notification on lockout
  - [ ] `isLocked()`, `lockAccount()`, `unlockAccount()`

#### Session Management (CRITICAL)
- [ ] Implement session tracking:
  - [ ] Store sessions in database
  - [ ] Track device info, IP, user agent
  - [ ] Max sessions per user
  - [ ] `getSessions()`, `revokeSession()`, `revokeAllSessions()`

#### Email Verification
- [ ] Implement email verification:
  - [ ] Generate verification tokens
  - [ ] Link-based verification
  - [ ] Send via email provider
  - [ ] `sendVerificationEmail()`, `verifyEmail()`

#### Password Reset
- [ ] Implement password reset:
  - [ ] Generate reset tokens
  - [ ] Link-based reset
  - [ ] Expiration (1h default)
  - [ ] Send via email provider
  - [ ] `sendPasswordResetEmail()`, `resetPassword()`
  - [ ] `changePassword()` for logged-in users

#### Auth Directives
- [ ] Implement directive parsing:
  - [ ] Field directives: `@auth.email`, `@auth.password`, `@auth.role`, `@owner`
  - [ ] Policy directives: `@public`, `@authenticated`, `@owner`, `@role(...)`, `@custom(...)`
  - [ ] OR operator: `|`
  - [ ] Compile to executable checks

#### Auto-Generated Endpoints
- [ ] Create auth endpoint handlers:
  - [ ] `POST /auth/signup`
  - [ ] `POST /auth/login`
  - [ ] `POST /auth/logout`
  - [ ] `POST /auth/refresh`
  - [ ] `GET /auth/me`
  - [ ] `POST /auth/password/reset`
  - [ ] `POST /auth/password/reset/confirm`
  - [ ] `POST /auth/password/change`
  - [ ] `POST /auth/verify/send`
  - [ ] `GET /auth/verify/:token`
  - [ ] `GET /auth/sessions`
  - [ ] `DELETE /auth/sessions/:id`
  - [ ] `DELETE /auth/sessions`

#### Middleware
- [ ] Implement auth middleware:
  - [ ] Extract token from header/cookie
  - [ ] Validate and decode JWT
  - [ ] Attach `ctx.auth.user`
  - [ ] Apply to protected routes

---

### Task 2.7: Storage Provider (Local Adapter)
**Status:** ⏳ Pending  
**Priority:** 🟡 Seventh  
**Estimated:** 4 hours  
**Files:**
- `packages/core/src/providers/storage/types.ts` (NEW)
- `packages/core/src/providers/storage/index.ts` (NEW)
- `packages/core/src/providers/storage/adapters/local.ts` (NEW)

**Work:**
- [ ] Create `StorageProviderConfig` interface
- [ ] Create `StorageAPI` interface
- [ ] Implement local adapter:
  - [ ] Create upload directory structure
  - [ ] Implement `upload()` with file size limits/MIME validation
  - [ ] Implement `download()` and `stream()`
  - [ ] Implement `getUrl()` for public files
  - [ ] Implement `delete()`, `exists()`, `list()`
  - [ ] Implement `copy()`, `move()`
  - [ ] Implement `getMetadata()`
- [ ] Static file serving middleware
- [ ] Integrate with existing `@yamajs/storage` package

---

## Phase 3: Integration

### Task 3.1: Configuration Parsing
**Status:** ⏳ Pending  
**Estimated:** 4 hours  
**Files:**
- `packages/core/src/providers/config-parser.ts` (NEW)
- `packages/cli/src/yama.schema.json` (MODIFY)

**Work:**
- [ ] Add `providers:` block to YAML schema
- [ ] Implement configuration parsing for all 7 providers
- [ ] Implement variable substitution (`${VAR:default}`)
- [ ] Validate provider configurations
- [ ] Handle adapter selection
- [ ] Support environment-specific overrides

---

### Task 3.2: Handler Context Integration
**Status:** ⏳ Pending  
**Estimated:** 4 hours  
**Files:**
- `packages/core/src/plugins/context.ts` (MODIFY)
- `packages/node/src/handlers/context.ts` (MODIFY)

**Work:**
- [ ] Add all 7 providers to HandlerContext:
  - `ctx.config`, `ctx.log`, `ctx.db`, `ctx.cache`, `ctx.email`, `ctx.auth`, `ctx.storage`
- [ ] Initialize providers before request handling
- [ ] Create request-scoped child loggers
- [ ] Extract and validate JWT from requests
- [ ] Add error helpers (`ctx.notFound()`, `ctx.unauthorized()`, etc.)

---

### Task 3.3: CLI Integration
**Status:** ⏳ Pending  
**Estimated:** 3 hours  
**Files:**
- `packages/cli/src/commands/dev.ts` (MODIFY)
- `packages/cli/src/commands/start.ts` (MODIFY)

**Work:**
- [ ] Initialize provider system on startup
- [ ] Handle provider errors gracefully
- [ ] Implement graceful shutdown
- [ ] Add provider status to health checks
- [ ] Show email capture mode status
- [ ] Register `/__yama/emails` route in dev mode

---

### Task 3.4: Provider Index and Exports
**Status:** ⏳ Pending  
**Estimated:** 2 hours  
**Files:**
- `packages/core/src/providers/index.ts` (NEW)
- `packages/core/src/index.ts` (MODIFY)

**Work:**
- [ ] Export all provider types
- [ ] Export provider registry
- [ ] Export built-in adapters
- [ ] Add to main core exports

---

## Phase 4: Testing

### Task 4.1: Unit Tests
**Status:** ⏳ Pending  
**Estimated:** 8 hours  
**Files:**
- `packages/core/src/providers/__tests__/registry.test.ts` (NEW)
- `packages/core/src/providers/__tests__/config.test.ts` (NEW)
- `packages/core/src/providers/__tests__/logging.test.ts` (NEW)
- `packages/core/src/providers/__tests__/database.test.ts` (NEW)
- `packages/core/src/providers/__tests__/cache.test.ts` (NEW)
- `packages/core/src/providers/__tests__/email.test.ts` (NEW)
- `packages/core/src/providers/__tests__/auth.test.ts` (NEW)
- `packages/core/src/providers/__tests__/storage.test.ts` (NEW)

**Work:**
- [ ] Test provider registry initialization/shutdown
- [ ] Test each provider adapter
- [ ] Test configuration parsing and validation
- [ ] Test variable substitution
- [ ] Test error handling
- [ ] Test auth security features:
  - [ ] Refresh token rotation
  - [ ] Rate limiting
  - [ ] Account lockout
  - [ ] Password validation
  - [ ] Breach checking

---

### Task 4.2: Integration Tests
**Status:** ⏳ Pending  
**Estimated:** 4 hours  
**Files:**
- `packages/core/src/providers/__tests__/integration.test.ts` (NEW)

**Work:**
- [ ] Test full provider stack initialization
- [ ] Test provider shutdown order
- [ ] Test handler context access
- [ ] Test with real yama.yaml configuration
- [ ] Test auth flow end-to-end
- [ ] Test email capture mode

---

## Phase 5: Documentation

### Task 5.1: Documentation
**Status:** ⏳ Pending  
**Estimated:** 6 hours  
**Files:**
- `docs/providers/README.md` (NEW)
- `docs/providers/config.md` (NEW)
- `docs/providers/logging.md` (NEW)
- `docs/providers/database.md` (NEW)
- `docs/providers/cache.md` (NEW)
- `docs/providers/email.md` (NEW)
- `docs/providers/auth.md` (NEW)
- `docs/providers/storage.md` (NEW)

**Work:**
- [ ] Write provider overview
- [ ] Document each provider with examples
- [ ] Document configuration options
- [ ] Document adapter extensibility
- [ ] Document auth directives and policies
- [ ] Document email templates and customization
- [ ] Document migration from current setup

---

## Dependencies

```
Phase 1 (Core Infrastructure)
    ↓
Phase 2.1 (Config) → Phase 2.2 (Logging)
    ↓
Phase 2.3 (Database) → Phase 2.4 (Cache) → Phase 2.5 (Email)
    ↓
Phase 2.6 (Auth) → Phase 2.7 (Storage)
    ↓
Phase 3 (Integration)
    ↓
Phase 4 (Testing)
    ↓
Phase 5 (Documentation)
```

---

## Estimated Timeline

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| **Phase 1:** Core Infrastructure | 3 tasks | 4-5 hours |
| **Phase 2:** Built-in Adapters | | |
| ├── Config | Task 2.1 | 4 hours |
| ├── Logging | Task 2.2 | 4 hours |
| ├── Database | Task 2.3 | 6 hours |
| ├── Cache | Task 2.4 | 4 hours |
| ├── Email | Task 2.5 | 8 hours |
| ├── Auth | Task 2.6 | 16 hours |
| └── Storage | Task 2.7 | 4 hours |
| **Phase 3:** Integration | 4 tasks | 13 hours |
| **Phase 4:** Testing | 2 tasks | 12 hours |
| **Phase 5:** Documentation | 1 task | 6 hours |
| **Total** | | **~77 hours** (~10 weeks @ 8hr/week) |

---

## Security Features Checklist

### Auth Provider Security

| Feature | Status | Priority |
|---------|--------|----------|
| Short-lived access tokens (15m) | ⏳ | 🔴 Critical |
| Refresh token rotation | ⏳ | 🔴 Critical |
| Refresh token revocation | ⏳ | 🔴 Critical |
| Password hashing (scrypt) | ⏳ | 🔴 Critical |
| Password strength validation | ⏳ | 🔴 Critical |
| Common password denial | ⏳ | 🔴 Critical |
| Breach checking (haveibeenpwned) | ⏳ | 🟡 High |
| Rate limiting (login/signup/reset) | ⏳ | 🔴 Critical |
| Account lockout | ⏳ | 🔴 Critical |
| Lockout email notification | ⏳ | 🟡 High |
| Session tracking | ⏳ | 🔴 Critical |
| Session revocation | ⏳ | 🔴 Critical |
| Max sessions per user | ⏳ | 🟡 High |
| HttpOnly cookies | ⏳ | 🔴 Critical |
| Secure cookies (HTTPS) | ⏳ | 🔴 Critical |
| SameSite cookies | ⏳ | 🔴 Critical |
| Email verification | ⏳ | 🟡 High |
| Password reset (secure tokens) | ⏳ | 🔴 Critical |

---

## Notes

- All 7 providers are built-in with zero external dependencies
- The provider system is separate from the plugin system
- Providers are for core infrastructure, plugins are for external services
- All built-in adapters use Node.js built-in modules where possible
- Adapters can be swapped without code changes:
  - pglite → postgres
  - memory → redis
  - smtp → resend/sendgrid
  - local → s3
- Auth provider is the most complex (~16 hours) due to security requirements
- Email provider includes dev capture mode and built-in templates
