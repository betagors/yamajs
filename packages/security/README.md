# @betagors/yama-security

Security plugin for Yama framework providing CORS, CSRF protection, security headers, and input sanitization.

## Features

- **CORS (Cross-Origin Resource Sharing)** - Configure allowed origins, methods, and headers
- **CSRF Protection** - Token-based protection against Cross-Site Request Forgery attacks
- **Security Headers** - Set security headers like CSP, HSTS, X-Frame-Options, and more
- **Input Sanitization** - Sanitize request data to prevent XSS, SQL injection, and other attacks

## Installation

```bash
pnpm add @betagors/yama-security
# or
npm install @betagors/yama-security
# or
yarn add @betagors/yama-security
```

## Usage

### Basic Configuration

Add the security plugin to your `yama.yaml`:

```yaml
plugins:
  - name: "@betagors/yama-security"
    config:
      cors:
        origins: ["https://example.com"]
        credentials: true
      csrf:
        enabled: true
        secret: "${CSRF_SECRET}"
      headers:
        contentSecurityPolicy: "default-src 'self'"
        strictTransportSecurity:
          maxAge: 31536000
          includeSubDomains: true
      sanitization:
        enabled: true
        maxStringLength: 10000
```

### CORS Configuration

```yaml
cors:
  origins: ["https://example.com", "https://app.example.com"]  # or "*" for all
  methods: ["GET", "POST", "PUT", "DELETE"]
  allowedHeaders: ["Content-Type", "Authorization", "X-Custom-Header"]
  exposedHeaders: ["X-Total-Count"]
  credentials: true
  maxAge: 86400  # 24 hours
```

### CSRF Protection

```yaml
csrf:
  enabled: true
  secret: "${CSRF_SECRET}"  # Use environment variable
  cookieName: "_csrf"
  headerName: "X-CSRF-Token"
  cookieOptions:
    httpOnly: true
    secure: true
    sameSite: "lax"
    path: "/"
  protectedMethods: ["POST", "PUT", "PATCH", "DELETE"]
  excludePaths: ["/api/webhook/*"]  # Exclude webhook endpoints
```

### Security Headers

```yaml
headers:
  contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline'"
  contentTypeNosniff: true
  frameOptions: "DENY"  # or "SAMEORIGIN"
  xssProtection: "1; mode=block"
  strictTransportSecurity:
    maxAge: 31536000
    includeSubDomains: true
    preload: false
  referrerPolicy: "strict-origin-when-cross-origin"
  permissionsPolicy: "geolocation=(), microphone=(), camera=()"
```

### Input Sanitization

```yaml
sanitization:
  enabled: true
  sanitizeHtml: true
  sanitizeSql: true
  sanitizeXss: true
  maxStringLength: 10000
  excludePaths: ["/api/upload/*"]
```

## API

### Plugin API

The plugin exposes the following API:

```typescript
import type { SecurityPluginConfig } from "@betagors/yama-security";

// Get plugin API
const securityAPI = getPluginAPI("@betagors/yama-security");

// Update configuration
securityAPI.updateConfig({
  cors: { origins: ["https://new-origin.com"] }
});

// Get current configuration
const config = securityAPI.getConfig();
```

### Programmatic Usage

You can also use the security functions directly:

```typescript
import {
  applyCorsHeaders,
  validateCsrfToken,
  applySecurityHeaders,
  sanitizeRequestData,
} from "@betagors/yama-security";

// Apply CORS headers
applyCorsHeaders(request, response, corsConfig);

// Validate CSRF token
const result = validateCsrfToken(request, response, csrfConfig);

// Apply security headers
applySecurityHeaders(response, headersConfig);

// Sanitize data
const sanitized = sanitizeRequestData(data, sanitizationConfig);
```

## Middleware

The security plugin automatically registers middleware that runs in the `pre-auth` phase with high priority (10). This ensures security checks happen before authentication and other processing.

The middleware handles:
1. CORS preflight requests (OPTIONS)
2. CSRF token validation
3. Security headers application
4. CORS headers for regular requests
5. Input sanitization

## Disabling Features

You can disable individual features by setting them to `false`:

```yaml
plugins:
  - name: "@betagors/yama-security"
    config:
      cors: false  # Disable CORS
      csrf: false  # Disable CSRF
      headers: false  # Disable security headers
      sanitization: false  # Disable sanitization
```

## Best Practices

1. **Always use environment variables** for secrets (CSRF secret, etc.)
2. **Configure CORS origins explicitly** - avoid using `"*"` in production
3. **Enable CSRF protection** for all state-changing operations
4. **Set appropriate security headers** based on your application needs
5. **Review excluded paths** regularly to ensure they're still necessary
6. **Test your configuration** in development before deploying to production

## License

MPL-2.0



















