# @betagors/yama-sdk

> TypeScript SDK generator for Yama (internal tool)

[![npm version](https://img.shields.io/npm/v/@betagors/yama-sdk.svg)](https://www.npmjs.com/package/@betagors/yama-sdk)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)

Internal tool used by the Yama CLI to generate type-safe TypeScript SDKs from `yama.yaml` configurations. This package is typically used indirectly through the CLI, but can also be used programmatically.

## Installation

```bash
npm install @betagors/yama-sdk
```

## Usage

### Programmatic Usage

```typescript
import { generateSDK, type YamaConfig } from '@betagors/yama-sdk';

const config: YamaConfig = {
  name: 'my-api',
  version: '1.0.0',
  endpoints: [
    {
      path: '/todos',
      method: 'GET',
      response: {
        type: 'list',
        items: 'Todo'
      }
    },
    {
      path: '/todos',
      method: 'POST',
      body: { type: 'Todo' },
      response: { type: 'Todo' }
    }
  ],
  schemas: {
    Todo: {
      fields: {
        id: { type: 'string', format: 'uuid' },
        title: { type: 'string' },
        completed: { type: 'boolean' }
      }
    }
  }
};

const sdkCode = generateSDK(config, {
  baseUrl: 'http://localhost:3000',
  framework: 'react'  // or 'nextjs', 'vanilla'
});

// Write to file
import { writeFileSync } from 'fs';
writeFileSync('./src/generated/sdk.ts', sdkCode);
```

### CLI Usage

This package is primarily used by the Yama CLI:

```bash
yama generate
yama generate --framework react
yama generate --output src/lib/api.ts
```

## Options

```typescript
interface GenerateSDKOptions {
  baseUrl?: string;        // API base URL
  framework?: 'react' | 'nextjs' | 'vanilla';  // Framework-specific helpers
  output?: string;         // Output file path
  typesOnly?: boolean;     // Generate types only
  sdkOnly?: boolean;       // Generate SDK only
}
```

## Generated SDK

The generated SDK provides a type-safe API client:

```typescript
// Generated SDK example
import { api } from './generated/sdk';

// Type-safe API calls
const todos = await api.todos.get();
const newTodo = await api.todos.post({
  title: 'New Todo',
  completed: false
});
```

### Framework-Specific Helpers

#### React

```typescript
import { useTodos } from './generated/hooks';

function TodoList() {
  const { data, loading, error } = useTodos();
  // ...
}
```

## Yama IR and runtime client

You can also consume the Yama IR (intermediate representation) directly and use the lightweight runtime client:

```bash
# emit IR from your project
yama generate --ir ./.yama/yama-ir.json
```

```typescript
import { YamaClient } from '@betagors/yama-sdk';
import ir from './.yama/yama-ir.json';

async function main() {
  const client = await YamaClient.create({ ir, baseUrl: 'http://localhost:4000' });
  const users = await client.request({ method: 'GET', path: '/users' });
  console.log(users);
}
```

For private APIs, keep the IR local or serve `/yama/ir` with authentication enabled.

#### Next.js

```typescript
import { useTodos } from './generated/hooks';

export default function TodoPage() {
  const { data, isLoading } = useTodos();
  // ...
}
```

## Requirements

- Node.js >= 18

## Note

This package is primarily intended for internal use by the Yama CLI. Most users should use the CLI commands rather than importing this package directly.

## License

MPL-2.0


