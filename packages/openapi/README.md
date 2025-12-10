# @betagors/yama-openapi

> OpenAPI documentation generator for Yama (internal tool)

[![npm version](https://img.shields.io/npm/v/@betagors/yama-openapi.svg)](https://www.npmjs.com/package/@betagors/yama-openapi)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

Internal tool used by the Yama runtime to generate OpenAPI 3.0 specifications from `yama.yaml` configurations. This package is typically used indirectly through the runtime, but can also be used programmatically.

## Installation

```bash
npm install @betagors/yama-openapi
```

## Usage

### Programmatic Usage

```typescript
import { generateOpenAPI, type YamaConfig } from '@betagors/yama-openapi';

const config: YamaConfig = {
  name: 'my-api',
  version: '1.0.0',
  schemas: {
    Todo: {
      fields: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        completed: { type: 'boolean' }
      }
    }
  },
  endpoints: [
    {
      path: '/todos',
      method: 'GET',
      description: 'List all todos',
      response: {
        type: 'list',
        items: 'Todo'
      }
    },
    {
      path: '/todos/:id',
      method: 'GET',
      description: 'Get a todo by ID',
      params: {
        id: { type: 'string', required: true }
      },
      response: { type: 'Todo' }
    }
  ],
  auth: {
    providers: [
      {
        type: 'jwt',
        secret: 'your-secret'
      }
    ]
  }
};

const openAPISpec = generateOpenAPI(config);

// Output OpenAPI 3.0 specification
console.log(JSON.stringify(openAPISpec, null, 2));
```

### Runtime Integration

The Yama runtime automatically generates OpenAPI documentation and serves it at `/openapi.json` and `/docs`:

```typescript
import { startYamaNodeRuntime } from '@betagors/yama-node';

const server = await startYamaNodeRuntime(3000, './yama.yaml');

// OpenAPI spec available at:
// GET http://localhost:3000/openapi.json
// GET http://localhost:3000/docs (Swagger UI)
```

## Generated OpenAPI Specification

The generator creates a complete OpenAPI 3.0 specification including:

- **Info** - API name, version, description
- **Paths** - All endpoints with methods, parameters, request/response schemas
- **Components** - Reusable schemas and security schemes
- **Security** - Authentication schemes (JWT, API keys)

### Example Output

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "my-api",
    "version": "1.0.0"
  },
  "paths": {
    "/todos": {
      "get": {
        "summary": "List all todos",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "$ref": "#/components/schemas/Todo"
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "Todo": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "format": "uuid"
          },
          "title": {
            "type": "string"
          },
          "completed": {
            "type": "boolean"
          }
        }
      }
    },
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  }
}
```

## Features

- **Automatic Schema Conversion** - Converts Yama schemas to OpenAPI schemas
- **Entity Support** - Converts Yama entities to OpenAPI schemas
- **Path Parameters** - Extracts and documents path parameters (`:id` → `{id}`)
- **Query Parameters** - Documents query parameters with validation rules
- **Request/Response Bodies** - Documents request and response schemas
- **Authentication** - Documents JWT and API key authentication
- **Security Requirements** - Adds security requirements to protected endpoints

## Requirements

- Node.js >= 18
- `@betagors/yama-core` - For schema types and utilities

## Note

This package is primarily intended for internal use by the Yama runtime. Most users will access the generated documentation through the runtime's `/openapi.json` and `/docs` endpoints rather than using this package directly.

## License

MPL-2.0


