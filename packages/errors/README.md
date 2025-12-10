# @betagors/yama-errors

Standardized error handling for YAMA applications.

## Features

- Custom error class hierarchy with error codes
- Standardized API error response format
- Multi-format support (REST, GraphQL, MCP)
- Request ID correlation
- Developer-friendly error messages with suggestions

## Installation

```bash
pnpm add @betagors/yama-errors
```

## Usage

### Throwing Errors

```typescript
import { 
  ValidationError, 
  NotFoundError, 
  AuthenticationError,
  ErrorCodes 
} from '@betagors/yama-errors';

// Validation error with details
throw new ValidationError('Invalid request body', {
  code: ErrorCodes.VALIDATION_BODY,
  details: [
    { field: 'email', message: 'Invalid email format' }
  ]
});

// Not found error
throw new NotFoundError('User not found', {
  code: ErrorCodes.NOT_FOUND_ENTITY,
  context: { entityType: 'User', id: '123' }
});

// Authentication error with suggestions
throw new AuthenticationError('Invalid token', {
  code: ErrorCodes.AUTH_INVALID_TOKEN,
  suggestions: [
    'Check that your token has not expired',
    'Ensure you are using the correct authentication header format'
  ]
});
```

### Formatting Errors for API Responses

```typescript
import { formatRestError, formatGraphQLError } from '@betagors/yama-errors';

// REST API format
const restResponse = formatRestError(error, requestId);
// {
//   error: {
//     code: 'VALIDATION_BODY',
//     message: 'Invalid request body',
//     details: [...],
//     requestId: 'abc-123',
//     timestamp: '2024-01-01T00:00:00.000Z'
//   }
// }

// GraphQL format
const graphqlError = formatGraphQLError(error, path, locations);
// {
//   message: 'Invalid request body',
//   path: ['createUser'],
//   locations: [...],
//   extensions: { code: 'VALIDATION_BODY', ... }
// }
```

### Error Codes

All error codes are defined in `ErrorCodes`:

- `VALIDATION_*` - Input validation errors
- `AUTH_*` - Authentication errors
- `AUTHZ_*` - Authorization errors
- `NOT_FOUND_*` - Resource not found errors
- `DB_*` - Database errors
- `PLUGIN_*` - Plugin errors
- `CONFIG_*` - Configuration errors
- `RATE_LIMIT` - Rate limiting errors
- `EXTERNAL_*` - External service errors

## API Reference

### Error Classes

| Class | Default Status | Use Case |
|-------|---------------|----------|
| `YamaError` | 500 | Base error class |
| `ValidationError` | 400 | Input validation failures |
| `AuthenticationError` | 401 | Authentication failures |
| `AuthorizationError` | 403 | Permission denied |
| `NotFoundError` | 404 | Resource not found |
| `RateLimitError` | 429 | Rate limit exceeded |
| `ConfigurationError` | 500 | Configuration issues |
| `DatabaseError` | 500 | Database operation failures |
| `PluginError` | 500 | Plugin-related errors |
| `ExternalServiceError` | 502 | External API failures |

### Utilities

- `isYamaError(error)` - Type guard for YamaError
- `normalizeError(error)` - Convert any error to YamaError
- `formatRestError(error, requestId?)` - Format for REST API
- `formatGraphQLError(error, path?, locations?)` - Format for GraphQL
- `formatMCPError(error)` - Format for MCP tools
