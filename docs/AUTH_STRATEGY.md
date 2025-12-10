# Yama Authentication & Authorization Strategy

This document provides a comprehensive overview of authentication and authorization in Yama, including architecture decisions, implementation phases, and detailed specifications for each auth strategy.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Architecture Overview](#architecture-overview)
3. [The Four Pillars of Auth](#the-four-pillars-of-auth)
4. [Implementation Tiers](#implementation-tiers)
5. [Core Auth (Built-in)](#core-auth-built-in)
6. [Auth Plugins](#auth-plugins)
7. [Authorization Models](#authorization-models)
8. [Session Management](#session-management)
9. [Token Strategies](#token-strategies)
10. [Auth Endpoints](#auth-endpoints)
11. [Configuration Reference](#configuration-reference)
12. [Handler Context API](#handler-context-api)
13. [Security Considerations](#security-considerations)
14. [Implementation Phases](#implementation-phases)

---

## Philosophy

Yama's auth system follows these core principles:

1. **Config-first**: Authentication rules are declared in YAML, not scattered in code
2. **Minimal core**: Only essential auth (JWT, API keys, Basic) is built into core
3. **Plugin extensibility**: Advanced auth (OAuth, MFA, Passkeys) via plugins
4. **Smart defaults**: Sensible defaults that work out of the box
5. **Escape hatches**: Custom handlers when declarative config isn't enough
6. **AI-friendly**: Predictable config patterns that AI tools can generate correctly

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Request                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Middleware: pre-auth                          │
│                 (Security headers, CORS, etc.)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │     JWT     │  │   API Key   │  │    Basic    │   ...more    │
│  │  Provider   │  │  Provider   │  │  Provider   │   providers  │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  Provider Registry: registerAuthProvider(type, handler)          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHORIZATION                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │    Roles    │  │ Permissions │  │   Custom    │              │
│  │    Check    │  │    Check    │  │   Handler   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Middleware: post-auth                         │
│                    (Rate limiting, etc.)                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Handler                                   │
│              context.auth.user, context.auth.can()               │
└─────────────────────────────────────────────────────────────────┘
```

---

## The Four Pillars of Auth

Every authentication system has four pillars:

### 1. Identity (Authentication)

**"Who are you?"**

How the user proves their identity:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| Email + Password | Classic credentials | First-party apps |
| OAuth 2.0 / OIDC | External identity providers | Social login, enterprise SSO |
| API Keys | Static or rotating keys | Machine-to-machine, third-party integrations |
| Magic Links | Passwordless email links | Low-friction signup |
| OTP | One-time passcodes (SMS/email) | Passwordless, MFA |
| Passkeys | WebAuthn / FIDO2 / Biometric | Modern passwordless |
| SAML 2.0 | Enterprise federation | Corporate SSO |
| mTLS | Mutual TLS certificates | Service-to-service |

### 2. Session (State Management)

**"How do we remember you?"**

How the server maintains user state:

| Strategy | Description | Use Case |
|----------|-------------|----------|
| JWT Access Tokens | Stateless, short-lived | APIs, serverless |
| JWT Refresh Tokens | Long-lived, for token renewal | Mobile apps, SPAs |
| Session Cookies | Server-stored session | Traditional web apps |
| Opaque Tokens | Random string, server-validated | High-security scenarios |

### 3. Authorization

**"What are you allowed to do?"**

How permissions are determined:

| Model | Description | Use Case |
|-------|-------------|----------|
| RBAC | Role-Based Access Control | Most applications |
| Permissions | Fine-grained permission checks | APIs with granular access |
| ABAC | Attribute-Based Access Control | Complex policies |
| ReBAC | Relationship-Based Access Control | Google Drive-style sharing |
| ACLs | Access Control Lists | Resource-specific permissions |
| Scopes | OAuth-style scopes | API access control |

### 4. Provider (Identity Storage)

**"Where is identity stored?"**

Where user identities live:

| Provider | Description |
|----------|-------------|
| Local Database | Users stored in your database |
| Clerk | Managed auth service |
| Auth0 | Enterprise identity platform |
| Supabase Auth | Supabase's auth service |
| Firebase Auth | Google's auth service |
| AWS Cognito | AWS identity service |
| LDAP / Active Directory | Enterprise directories |

---

## Implementation Tiers

### Tier 1: Core (Built into `yama-core`)

Zero dependencies, always available:

| Feature | Description |
|---------|-------------|
| JWT Provider | Access + refresh token validation |
| API Key Provider | Header-based API key validation |
| Basic Auth Provider | Username/password with static or database mode |
| RBAC | Role-based access control |
| Permissions | Fine-grained permission checks |
| Token Generation | JWT creation utilities |
| Password Hashing | bcrypt utilities |

### Tier 2: First-Party Plugins

Official Yama packages:

| Package | Features |
|---------|----------|
| `yama-session` | Cookie sessions, Redis/memory store |
| `yama-oauth` | OAuth 2.0, OIDC, social providers |
| `yama-mfa` | TOTP, SMS MFA, Email MFA |
| `yama-passkeys` | WebAuthn, FIDO2, biometric |

### Tier 3: Vendor Plugins

Third-party service integrations:

| Package | Service |
|---------|---------|
| `yama-clerk` | Clerk |
| `yama-auth0` | Auth0 |
| `yama-supaauth` | Supabase Auth |
| `yama-fireauth` | Firebase Auth |
| `yama-cognito` | AWS Cognito |
| `yama-workos` | WorkOS SSO |

### Tier 4: Enterprise Plugins

Specialized enterprise needs:

| Package | Features |
|---------|----------|
| `yama-saml` | SAML 2.0 SSO |
| `yama-ldap` | LDAP/Active Directory |

---

## Core Auth (Built-in)

### JWT Provider

JSON Web Tokens for stateless authentication.

#### Configuration

```yaml
auth:
  providers:
    - type: jwt
      secret: ${JWT_SECRET}
      algorithm: HS256  # HS256, HS384, HS512, RS256, RS384, RS512, ES256, ES384, ES512
      issuer: my-app    # Optional: validate iss claim
      audience: my-api  # Optional: validate aud claim
      accessToken:
        expiresIn: 15m  # Access token lifetime
      refreshToken:
        enabled: true
        expiresIn: 7d   # Refresh token lifetime
        rotation: true  # Issue new refresh token on use
```

#### How It Works

1. Extract token from `Authorization: Bearer <token>` header
2. Verify signature using secret/public key
3. Validate claims (exp, iss, aud)
4. Extract user data from payload
5. Populate `AuthContext` with user info

#### Token Payload Structure

```json
{
  "sub": "user-123",
  "email": "user@example.com",
  "roles": ["user", "admin"],
  "iat": 1699900000,
  "exp": 1699900900,
  "iss": "my-app",
  "aud": "my-api"
}
```

#### Refresh Token Flow

```
Client                                 Server
  │                                      │
  │─── Access Token (expired) ──────────▶│
  │◀── 401 Unauthorized ────────────────│
  │                                      │
  │─── POST /auth/refresh ──────────────▶│
  │    { refreshToken: "..." }           │
  │                                      │
  │◀── { accessToken, refreshToken } ───│
  │    (new tokens)                      │
```

---

### API Key Provider

Static or validated API keys for machine-to-machine auth.

#### Configuration

```yaml
auth:
  providers:
    - type: api-key
      header: X-API-Key  # Header to extract key from
      # Optional: custom validator function
      # validate: ./validators/api-key.ts
```

#### How It Works

1. Extract API key from configured header
2. If custom validator provided, call it with the key
3. If no validator, accept any non-empty key (development only!)
4. Populate `AuthContext` with `provider: "api-key"`

#### Best Practices

- **Always use a custom validator in production**
- Store API keys hashed in database
- Support key rotation
- Log API key usage for auditing
- Set expiration dates on keys

---

### Basic Auth Provider

HTTP Basic Authentication with static credentials or database lookup.

#### Static Mode Configuration

```yaml
auth:
  providers:
    - type: basic
      mode: static
      identifier: ${ADMIN_USER}
      password: ${ADMIN_PASSWORD}
```

#### Database Mode Configuration

```yaml
auth:
  providers:
    - type: basic
      mode: database
      userEntity: User           # Entity to query
      identifierField: email     # Field to match username against
      passwordField: passwordHash # Field containing hashed password
```

#### How It Works

1. Extract credentials from `Authorization: Basic <base64>` header
2. Decode base64 to get `identifier:password`
3. **Static mode**: Compare against config values
4. **Database mode**: 
   - Query user entity by identifier
   - Compare password with bcrypt
   - Return user data in AuthContext

#### Security Notes

- Basic Auth transmits credentials with every request
- **Always use HTTPS** to prevent credential interception
- Database mode uses bcrypt for password comparison
- Consider using JWT for better security

---

### RBAC (Role-Based Access Control)

Built-in role and permission system.

#### Configuration

```yaml
auth:
  roles:
    superadmin:
      permissions: ["*"]  # Wildcard: all permissions
    admin:
      permissions:
        - users:*         # Wildcard: all user permissions
        - posts:*
        - settings:read
        - settings:write
    moderator:
      permissions:
        - posts:read
        - posts:update
        - posts:delete
        - comments:delete
    user:
      permissions:
        - posts:read
        - posts:create
        - "posts:update:own"  # Own resource only
        - "posts:delete:own"
        - comments:create
        - "comments:update:own"
```

#### Permission Format

```
{resource}:{action}
{resource}:{action}:{scope}
{resource}:*              # Wildcard: all actions
*                         # Wildcard: all permissions
```

#### How Authorization Works

1. User roles come from JWT payload or database
2. Endpoint specifies required roles or permissions
3. System checks if user has any matching role/permission
4. Wildcard matching: `posts:*` matches `posts:read`, `posts:write`, etc.

#### Endpoint Authorization

```yaml
endpoints:
  - path: /admin/users
    method: GET
    auth:
      required: true
      roles: [admin, superadmin]  # Role-based
      
  - path: /posts
    method: POST
    auth:
      required: true
      permissions: [posts:create]  # Permission-based
      
  - path: /posts/:id
    method: DELETE
    auth:
      required: true
      handler: ./auth/canDeletePost.ts  # Custom handler
```

---

## Auth Plugins

### `yama-session` - Session Management

Cookie-based sessions with pluggable stores.

#### Configuration

```yaml
plugins:
  "@betagors/yama-session":
    store: memory  # memory, redis
    cookie:
      name: yama_session
      secure: true       # HTTPS only
      httpOnly: true     # No JavaScript access
      sameSite: lax      # CSRF protection
      maxAge: 7d         # Cookie lifetime
      domain: .example.com  # Optional: cross-subdomain
      path: /            # Cookie path
    rolling: true        # Extend session on activity
    
    # Redis store config (if store: redis)
    redis:
      url: ${REDIS_URL}
      prefix: sess:
```

#### How It Works

1. On request, load session from cookie → store
2. Make session available via `context.session`
3. Handler can read/write session data
4. On response, save session back to store
5. Set/refresh session cookie

#### Session API

```typescript
// In handler
context.session.get("cart");           // Read value
context.session.set("cart", items);    // Set value
context.session.delete("cart");        // Delete value
context.session.destroy();             // Destroy entire session
context.session.regenerate();          // New session ID (security)
```

---

### `yama-oauth` - OAuth 2.0 / OIDC

OAuth 2.0 and OpenID Connect for social login and SSO.

#### Configuration

```yaml
plugins:
  "@betagors/yama-oauth":
    # Base callback URL (used to construct redirect URIs)
    callbackUrl: ${APP_URL}/auth/callback
    
    providers:
      google:
        clientId: ${GOOGLE_CLIENT_ID}
        clientSecret: ${GOOGLE_CLIENT_SECRET}
        scopes: [email, profile]
        
      github:
        clientId: ${GITHUB_CLIENT_ID}
        clientSecret: ${GITHUB_CLIENT_SECRET}
        scopes: [user:email, read:user]
        
      apple:
        clientId: ${APPLE_CLIENT_ID}
        teamId: ${APPLE_TEAM_ID}
        keyId: ${APPLE_KEY_ID}
        privateKey: ${APPLE_PRIVATE_KEY}
        
      microsoft:
        clientId: ${MS_CLIENT_ID}
        clientSecret: ${MS_CLIENT_SECRET}
        tenant: common  # common, organizations, consumers, or tenant ID
        
      discord:
        clientId: ${DISCORD_CLIENT_ID}
        clientSecret: ${DISCORD_CLIENT_SECRET}
        scopes: [identify, email]
        
      twitter:
        clientId: ${TWITTER_CLIENT_ID}
        clientSecret: ${TWITTER_CLIENT_SECRET}
        
      linkedin:
        clientId: ${LINKEDIN_CLIENT_ID}
        clientSecret: ${LINKEDIN_CLIENT_SECRET}
        scopes: [r_emailaddress, r_liteprofile]
        
      # Generic OIDC provider
      custom-idp:
        type: oidc
        issuer: https://idp.example.com
        clientId: ${CUSTOM_CLIENT_ID}
        clientSecret: ${CUSTOM_CLIENT_SECRET}
        scopes: [openid, email, profile]
    
    # User handling
    autoCreateUser: true      # Create user on first OAuth login
    linkAccounts: true        # Link OAuth to existing account by email
    userEntity: User          # Entity to store users
    
    # Field mapping
    fields:
      id: id
      email: email
      name: name
      avatar: avatarUrl
      googleId: googleId
      githubId: githubId
```

#### Generated Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /auth/{provider}` | Redirect to OAuth provider |
| `GET /auth/{provider}/callback` | OAuth callback handler |
| `POST /auth/link/{provider}` | Link OAuth to existing account |
| `POST /auth/unlink/{provider}` | Unlink OAuth from account |

#### OAuth Flow

```
User                    Yama                    Provider
 │                        │                        │
 │── GET /auth/google ───▶│                        │
 │                        │── Redirect ───────────▶│
 │◀─────────────────────────────────────── Login ──│
 │                        │◀── Callback + Code ────│
 │                        │── Exchange Code ──────▶│
 │                        │◀── Access Token ───────│
 │                        │── Get User Info ──────▶│
 │                        │◀── User Profile ───────│
 │                        │                        │
 │                        │ Create/Update User     │
 │                        │ Generate JWT           │
 │◀── JWT Tokens ─────────│                        │
```

---

### `yama-mfa` - Multi-Factor Authentication

TOTP, SMS, and Email-based second factors.

#### Configuration

```yaml
plugins:
  "@betagors/yama-mfa":
    methods:
      totp:
        enabled: true
        issuer: MyApp           # Shown in authenticator app
        algorithm: SHA1         # SHA1, SHA256, SHA512
        digits: 6               # Code length
        period: 30              # Code validity in seconds
        
      sms:
        enabled: true
        provider: twilio        # twilio, vonage, aws-sns
        from: "+1234567890"
        codeLength: 6
        codeExpiry: 10m
        # Twilio config
        twilio:
          accountSid: ${TWILIO_SID}
          authToken: ${TWILIO_AUTH_TOKEN}
          
      email:
        enabled: true
        codeLength: 6
        codeExpiry: 10m
        # Uses configured email plugin
    
    # Enforcement rules
    required: false                    # Require MFA for all users
    enforceFor: [admin, superadmin]   # Require for specific roles
    gracePeriod: 7d                   # Time to set up MFA after signup
    
    # Recovery
    backupCodes:
      enabled: true
      count: 10                       # Number of backup codes
      
    # Rate limiting
    rateLimit:
      attempts: 5
      window: 15m
      lockout: 1h
```

#### MFA Flow

```
1. User logs in with password
2. Server checks if MFA is required/enabled
3. If MFA required:
   a. Return partial session + MFA challenge
   b. User enters TOTP code / receives SMS
   c. Verify code
   d. Complete authentication, issue full tokens
```

#### Generated Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /auth/mfa/setup/totp` | Get TOTP setup (QR code, secret) |
| `POST /auth/mfa/verify/totp` | Verify TOTP code |
| `POST /auth/mfa/setup/sms` | Set up SMS MFA |
| `POST /auth/mfa/verify/sms` | Verify SMS code |
| `POST /auth/mfa/setup/email` | Set up Email MFA |
| `POST /auth/mfa/verify/email` | Verify Email code |
| `POST /auth/mfa/backup-codes` | Generate backup codes |
| `POST /auth/mfa/verify/backup` | Verify backup code |
| `DELETE /auth/mfa/{method}` | Disable MFA method |

---

### `yama-passkeys` - WebAuthn / FIDO2

Modern passwordless authentication with biometrics and hardware keys.

#### Configuration

```yaml
plugins:
  "@betagors/yama-passkeys":
    rpName: My Application          # Relying Party name (shown to user)
    rpId: example.com               # Relying Party ID (domain)
    origin: https://example.com     # Expected origin
    
    # Authenticator preferences
    authenticatorSelection:
      authenticatorAttachment: platform  # platform, cross-platform, or omit
      residentKey: preferred             # discouraged, preferred, required
      userVerification: preferred        # discouraged, preferred, required
    
    # Attestation
    attestation: none               # none, indirect, direct, enterprise
    
    # Timeout for registration/authentication
    timeout: 60000                  # 60 seconds
    
    # Storage
    credentialEntity: Passkey       # Entity to store credentials
```

#### Generated Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /auth/passkeys/register/options` | Get registration options |
| `POST /auth/passkeys/register/verify` | Verify registration response |
| `POST /auth/passkeys/login/options` | Get authentication options |
| `POST /auth/passkeys/login/verify` | Verify authentication response |
| `GET /auth/passkeys` | List user's passkeys |
| `DELETE /auth/passkeys/:id` | Remove a passkey |

#### Passkey Flow

```
Registration:
1. Client requests registration options
2. Server generates challenge, returns options
3. Client calls navigator.credentials.create()
4. User performs biometric/PIN verification
5. Client sends response to server
6. Server verifies and stores credential

Authentication:
1. Client requests authentication options
2. Server generates challenge, returns options
3. Client calls navigator.credentials.get()
4. User performs biometric/PIN verification
5. Client sends response to server
6. Server verifies signature, issues tokens
```

---

## Authorization Models

### RBAC (Role-Based Access Control)

**Built into core.**

```yaml
auth:
  roles:
    admin:
      permissions: ["*"]
    user:
      permissions: [posts:read, posts:create]

endpoints:
  - path: /admin
    auth:
      roles: [admin]
```

### Permission-Based

**Built into core.**

```yaml
endpoints:
  - path: /posts
    method: POST
    auth:
      permissions: [posts:create]
```

### Custom Authorization Handlers

**Built into core.**

```yaml
endpoints:
  - path: /posts/:id
    method: DELETE
    auth:
      handler: ./auth/canDeletePost.ts
```

```typescript
// auth/canDeletePost.ts
export default async function canDeletePost(
  authContext: AuthContext,
  request: { params: { id: string } }
): Promise<boolean> {
  // Check if user owns the post or is admin
  const post = await db.posts.findById(request.params.id);
  return post.authorId === authContext.user?.id || 
         authContext.user?.roles?.includes("admin");
}
```

### ABAC (Attribute-Based Access Control)

**Via custom handlers or future plugin.**

```typescript
// Complex ABAC logic
export default async function canAccess(authContext, request) {
  const { user } = authContext;
  const resource = await loadResource(request.params.id);
  
  // Time-based
  if (isWeekend() && !user.roles.includes("weekend-access")) {
    return false;
  }
  
  // Location-based
  if (resource.region !== user.region && !user.roles.includes("global")) {
    return false;
  }
  
  // Attribute-based
  if (resource.classification === "confidential" && user.clearance < 3) {
    return false;
  }
  
  return true;
}
```

---

## Session Management

### Stateless (JWT Only)

```yaml
auth:
  providers:
    - type: jwt
      secret: ${JWT_SECRET}
      accessToken: { expiresIn: 15m }
      refreshToken: { expiresIn: 7d }
```

**Pros:**
- No server-side storage
- Scales horizontally
- Works with serverless

**Cons:**
- Can't invalidate tokens before expiry
- Token size grows with claims

### Stateful (Sessions)

```yaml
plugins:
  "@betagors/yama-session":
    store: redis
    cookie: { secure: true, httpOnly: true }
```

**Pros:**
- Immediate invalidation
- Smaller cookie size
- Server controls session data

**Cons:**
- Requires session store
- Horizontal scaling needs shared store

### Hybrid (JWT + Session)

```yaml
auth:
  providers:
    - type: jwt
      secret: ${JWT_SECRET}

plugins:
  "@betagors/yama-session":
    store: redis
```

**Use case:** JWT for API auth, sessions for web app state.

---

## Token Strategies

### JWT (JSON Web Token)

```yaml
auth:
  providers:
    - type: jwt
      secret: ${JWT_SECRET}
      algorithm: HS256
```

**Best for:** APIs, serverless, microservices

### Opaque Tokens

Store random tokens in database/Redis, validate by lookup.

**Best for:** High-security scenarios where immediate revocation is critical

### PASETO (Platform-Agnostic Security Tokens)

Secure alternative to JWT with safer defaults.

**Best for:** When you need JWT-like functionality with better security guarantees

> **Note:** PASETO support planned for future release.

---

## Auth Endpoints

### Auto-Generated Endpoints

```yaml
auth:
  endpoints:
    enabled: true
    prefix: /auth
    
    register:
      enabled: true
      path: /register
      rateLimit: { window: 1h, max: 5 }
      requireEmailVerification: true
      
    login:
      enabled: true
      path: /login
      rateLimit: { window: 15m, max: 10 }
      
    logout:
      enabled: true
      path: /logout
      
    me:
      enabled: true
      path: /me
      
    refresh:
      enabled: true
      path: /refresh
      
    forgotPassword:
      enabled: true
      path: /forgot-password
      tokenExpiry: 1h
      
    resetPassword:
      enabled: true
      path: /reset-password
      
    verifyEmail:
      enabled: true
      path: /verify-email
      
    changePassword:
      enabled: true
      path: /change-password
```

### Endpoint Specifications

#### POST /auth/register

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "name": "John Doe",
    "emailVerified": false
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### POST /auth/login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user-123",
    "email": "user@example.com",
    "roles": ["user"]
  },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

**Response (200, MFA Required):**
```json
{
  "mfaRequired": true,
  "mfaToken": "mfa-session-token",
  "availableMethods": ["totp", "sms"]
}
```

#### POST /auth/refresh

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response (200):**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

#### GET /auth/me

**Headers:** `Authorization: Bearer <accessToken>`

**Response (200):**
```json
{
  "id": "user-123",
  "email": "user@example.com",
  "name": "John Doe",
  "roles": ["user"],
  "emailVerified": true,
  "createdAt": "2024-01-01T00:00:00Z"
}
```

#### POST /auth/logout

**Headers:** `Authorization: Bearer <accessToken>`

**Request:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Configuration Reference

### Complete Auth Configuration

```yaml
auth:
  # ===== Identity Providers =====
  providers:
    # JWT (stateless tokens)
    - type: jwt
      secret: ${JWT_SECRET}
      algorithm: HS256
      issuer: my-app
      audience: my-api
      accessToken:
        expiresIn: 15m
      refreshToken:
        enabled: true
        expiresIn: 7d
        rotation: true
    
    # API Key
    - type: api-key
      header: X-API-Key
    
    # Basic Auth (database mode)
    - type: basic
      mode: database
      userEntity: User
      identifierField: email
      passwordField: passwordHash
  
  # ===== Authorization =====
  roles:
    superadmin:
      permissions: ["*"]
    admin:
      permissions: [users:*, posts:*, settings:*]
    moderator:
      permissions: [posts:read, posts:update, posts:delete, comments:delete]
    user:
      permissions:
        - posts:read
        - posts:create
        - "posts:update:own"
        - "posts:delete:own"
        - comments:*
  
  # Default role for new users
  defaultRole: user
  
  # Guest permissions (unauthenticated users)
  guestPermissions:
    - posts:read
    - comments:read
  
  # ===== Auto-Generated Endpoints =====
  endpoints:
    enabled: true
    prefix: /auth
    
    register:
      enabled: true
      requireEmailVerification: true
      rateLimit: { window: 1h, max: 5 }
      
    login:
      enabled: true
      rateLimit: { window: 15m, max: 10 }
      
    logout: true
    me: true
    refresh: true
    forgotPassword: true
    resetPassword: true
    verifyEmail: true
    changePassword: true
  
  # ===== User Entity =====
  user:
    entity: User
    fields:
      id: id
      email: email
      password: passwordHash
      roles: roles
      emailVerified: emailVerified
      name: name
```

---

## Handler Context API

### Auth Context

```typescript
interface AuthContext {
  authenticated: boolean;
  user?: {
    id?: string;
    email?: string;
    roles?: string[];
    [key: string]: unknown;
  };
  provider?: string;  // "jwt", "api-key", "basic", "oauth-google", etc.
  token?: string;     // Raw token (if applicable)
}
```

### Available in Handlers

```typescript
export async function myHandler(context: HandlerContext) {
  // ===== Auth Context =====
  const { auth } = context;
  
  // Check if authenticated
  if (!auth?.authenticated) {
    return context.status(401).send({ error: "Unauthorized" });
  }
  
  // Access user info
  const userId = auth.user?.id;
  const userEmail = auth.user?.email;
  const userRoles = auth.user?.roles || [];
  
  // Check roles
  const isAdmin = userRoles.includes("admin");
  
  // Check permissions (helper method)
  if (!auth.can?.("posts:delete")) {
    return context.status(403).send({ error: "Forbidden" });
  }
  
  // Check resource ownership
  const post = await context.entities.Post.findById(context.params.id);
  if (post.authorId !== userId && !isAdmin) {
    return context.status(403).send({ error: "Not your post" });
  }
  
  // ===== Auth Actions (future) =====
  // Generate tokens for a user
  const tokens = await auth.generateTokens?.({ id: userId, roles: userRoles });
  
  // Hash password
  const hash = await auth.hashPassword?.("newPassword");
  
  // Verify password
  const valid = await auth.verifyPassword?.("password", hash);
  
  return { success: true };
}
```

---

## Security Considerations

### Password Security

- **Minimum length:** 12 characters recommended
- **Hashing:** bcrypt with cost factor 12+
- **No plaintext storage:** Ever
- **Rate limit login attempts:** Prevent brute force

### Token Security

- **Short access token lifetime:** 15 minutes or less
- **Secure refresh tokens:** HttpOnly cookies or secure storage
- **Token rotation:** New refresh token on each use
- **Revocation strategy:** Blacklist or token versioning

### Session Security

- **Secure cookies:** `Secure`, `HttpOnly`, `SameSite`
- **Session regeneration:** After login to prevent fixation
- **Idle timeout:** Expire inactive sessions
- **Absolute timeout:** Maximum session lifetime

### OAuth Security

- **PKCE:** Required for public clients (SPAs, mobile)
- **State parameter:** Prevent CSRF
- **Nonce:** Prevent replay attacks (OIDC)
- **Validate redirect URIs:** Prevent open redirect

### General

- **HTTPS only:** All auth endpoints
- **Rate limiting:** All auth endpoints
- **Audit logging:** Log auth events
- **MFA:** For sensitive operations

---

## Implementation Phases

### Phase 1: Core Enhancements (In `yama-core`)

| Task | Priority |
|------|----------|
| Add `generateTokens()` function | High |
| Add refresh token support to JWT provider | High |
| Add `hashPassword()`, `verifyPassword()` utilities | High |
| Add auto-generated auth endpoints config | Medium |
| Extend `AuthContext` with helper methods | Medium |

### Phase 2: Session Plugin (`yama-session`)

| Task | Priority |
|------|----------|
| Session middleware implementation | High |
| Memory store | High |
| Redis store | High |
| Cookie configuration | High |
| Session regeneration | Medium |

### Phase 3: OAuth Plugin (`yama-oauth`)

| Task | Priority |
|------|----------|
| OAuth 2.0 Authorization Code flow | High |
| PKCE support | High |
| Google provider | High |
| GitHub provider | High |
| Apple provider | Medium |
| Generic OIDC provider | Medium |
| Account linking | Medium |

### Phase 4: Advanced Auth (`yama-mfa`, `yama-passkeys`)

| Task | Priority |
|------|----------|
| TOTP (Google Authenticator) | High |
| SMS MFA | Medium |
| Email MFA | Medium |
| WebAuthn registration | Medium |
| WebAuthn authentication | Medium |
| Backup codes | Medium |

### Phase 5: Vendor Integrations

| Package | Priority |
|---------|----------|
| `yama-clerk` | Medium |
| `yama-auth0` | Medium |
| `yama-supaauth` | Low |
| `yama-cognito` | Low |

---

## Related Documents

- [Naming Conventions](./NAMING_CONVENTIONS.md) - Package naming guidelines
- [Roadmap](./ROADMAP.md) - Full feature roadmap
- [Contributing](../CONTRIBUTING.md) - How to contribute

---

## Changelog

- **2024-12**: Initial auth strategy document
