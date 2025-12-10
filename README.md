<div align="center">
  <img src="logo.svg" alt="Yama JS" width="120" />
  
  # Yama JS
  
  **The Backend Framework for Modern APIs**
  
  Configuration-first platform that turns YAML into fully functional APIs, SDKs, and documentation.
  
  [![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
  [![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)
  [![npm version](https://img.shields.io/npm/v/@betagors/yama-cli)](https://www.npmjs.com/package/@betagors/yama-cli)
  
  [Documentation](https://yamajs.org) • [Examples](./examples) • [GitHub](https://github.com/betagors/yamajs) • [Discussions](https://github.com/betagors/yamajs/discussions)
</div>

---

## 🎯 What is Yama?

Yama is a **configuration-first backend platform** that dramatically reduces boilerplate by separating structure from logic:

- **Structure** lives in YAML (schemas, endpoints, auth rules, behaviors)
- **Logic** lives in TypeScript handlers
- **Platform** handles everything else (routing, validation, generation, docs, consistency)

This approach enables teams to build APIs faster, safer, and with less code.

## ✨ Features

<div align="center">

| Feature | Description |
|---------|-------------|
| 🎯 **YAML-First** | Define your entire API structure in `yama.yaml` |
| 🚀 **Type-Safe** | Auto-generated TypeScript types and SDKs |
| 🔌 **Plugin System** | Extensible architecture with database and HTTP adapters |
| 📚 **Auto-Generated Docs** | OpenAPI documentation from your config |
| 🛠️ **Powerful CLI** | Development server, code generation, and migrations |
| 🔒 **Built-in Auth** | JWT authentication and authorization rules |
| 🗄️ **Database Support** | PostgreSQL and PGLite adapters with migrations |
| ⚡ **Fast Development** | Hot reload, watch mode, and instant feedback |

</div>

## 🚀 Quick Start

### Installation

```bash
npm install -g @betagors/yama-cli
```

### Create Your First API

```bash
yama create my-api
cd my-api
npm install
yama dev
```

Your API will be running at `http://localhost:4000` 🎉

## 📖 Example

### 1. Define Your API Structure

Create `yama.yaml`:

```yaml
name: my-api
version: 1.0.0

schemas:
  Todo:
    type: object
    properties:
      id:
        type: string
        format: uuid
      title:
        type: string
      completed:
        type: boolean
        default: false

entities:
  Todo:
    table: todos
    crud:
      enabled: true
    fields:
      id:
        type: uuid
        primary: true
        generated: true
      title:
        type: string
        required: true
      completed:
        type: boolean
        default: false
```

### 2. Write Your Business Logic (Optional)

For custom endpoints, create handlers:

```typescript
// src/handlers/listTodos.ts
import { HandlerContext } from '@betagors/yama-core';

export async function listTodos(context: HandlerContext) {
  const { search, limit = 10 } = context.query;
  
  return await context.entities.Todo.findAll({
    where: search ? { title: { ilike: `%${search}%` } } : {},
    limit: Number(limit)
  });
}
```

### 3. Generate Types and SDK

```bash
yama generate
```

This creates:
- `src/generated/types.ts` - TypeScript types
- `src/generated/sdk.ts` - Type-safe API client

### 4. Use the Generated SDK

```typescript
import { api } from './generated/sdk';

// Type-safe API calls
const todos = await api.todos.get({ search: 'learn' });
const newTodo = await api.todos.post({ 
  title: 'New Todo',
  completed: false 
});
```

That's it! Yama handles routing, validation, type generation, and documentation automatically.

## 📁 Project Structure

```
my-api/
├── yama.yaml              # API configuration
├── package.json
├── src/
│   ├── handlers/          # Your business logic
│   │   └── listTodos.ts
│   └── generated/         # Auto-generated (gitignored)
│       ├── types.ts
│       └── sdk.ts
├── migrations/            # Database migrations
└── .env                   # Environment variables
```

## 🛠️ CLI Commands

### Development

```bash
yama dev                  # Start development server
yama dev --port 3000      # Custom port
yama dev --no-watch       # Disable watch mode
```

### Code Generation

```bash
yama generate             # Generate types and SDK
yama generate --watch     # Watch mode
yama types               # Generate types only
yama sdk                 # Generate SDK only
```

### Database Migrations

```bash
yama migration:generate   # Generate migration from entities
yama migration:apply      # Apply pending migrations
yama migration:status    # Check migration status
yama migration:history    # View migration history
```

### Validation

```bash
yama validate            # Validate yama.yaml
yama validate --strict   # Strict validation
yama endpoints          # List all endpoints
yama schemas            # List all schemas
```

## 🧰 Dev Admin (AdminX)

- Optional plugin `@betagors/yama-adminx` for a dev-only admin UI (CRUD, schema/endpoints view, migrations summary).
- Enabled by default in development, disabled in production unless explicitly allowed.
- Requires a token: `Authorization: Bearer dev-adminx` by default. Set `ADMINX_PASSWORD` (or `YAMA_ADMINX_PASSWORD`) to override.
- Default path: `/adminx`

```yaml
plugins:
  "@betagors/yama-adminx":
    enabled: true            # auto-true in dev, false in prod
    path: /adminx
    requireAuth: true
    allowInProduction: false # set true only if you intentionally expose it
    # devPassword: ${ADMINX_PASSWORD}
```

## 🏗️ Architecture

Yama is built as a **monorepo** using pnpm workspaces and Turborepo:

```
yama/
├── packages/
│   ├── cli/              # CLI tool
│   ├── core/             # Core runtime and types
│   ├── postgres/         # PostgreSQL adapter
│   ├── pglite/           # PGLite adapter
│   ├── node/     # Node.js runtime
│   └── ...
├── apps/
│   └── docs/             # Documentation site
└── examples/             # Example projects
```

## 📚 Documentation

- 📖 **[Full Documentation](https://yamajs.org)** - Complete guides and API reference
- 🚀 **[Getting Started](https://yamajs.org/docs/getting-started)** - Installation and setup
- 🎓 **[Core Concepts](https://yamajs.org/docs/core-concepts)** - Schemas, entities, endpoints, handlers
- 📝 **[Examples](https://yamajs.org/docs/examples)** - Real-world examples and tutorials
- 🔌 **[Plugins](https://yamajs.org/plugins)** - Extend Yama with plugins

## 💡 Why Yama?

- **Less Boilerplate** - Define structure once, generate everything
- **Type Safety** - End-to-end type safety from config to client
- **AI-Friendly** - Structured config reduces AI hallucinations
- **Developer Experience** - Fast iteration, hot reload, instant feedback
- **Open Source** - Transparent, extensible, community-driven

## 🎯 Philosophy

Yama's core philosophy:

- **YAML defines the contract** - Structure is explicit and version-controlled
- **Code defines custom behavior** - Business logic stays in TypeScript
- **Yama guarantees correctness** - Type safety, validation, and consistency

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## 🔒 Security

Found a security vulnerability? Please see our [Security Policy](SECURITY.md) for details on how to report it responsibly.

## 📄 License

This project is licensed under the **Mozilla Public License 2.0 (MPL-2.0)** - see the [LICENSE](LICENSE) file for details.

The documentation site (`apps/docs-site`) is licensed under **MIT** - see [apps/docs-site/LICENSE](apps/docs-site/LICENSE) for details.

## 🗺️ Roadmap

### Phase 1: Core Platform ✅
- ✅ YAML-based configuration
- ✅ TypeScript handler system
- ✅ Database adapters (PostgreSQL, PGLite)
- ✅ HTTP server adapters (Fastify)
- ✅ Schema validation and code generation
- ✅ CLI tooling

### Phase 2: Enhanced Features 🔄
- 🔄 Serverless deployment support
- 📊 Advanced analytics and monitoring
- 🔐 Enhanced authentication providers
- 🚀 Automated scaling and optimization

### Phase 3: Full-Stack Expansion 📋
- 🎨 Frontend-as-config ("vibe config")
- 🤖 AI-assisted generation
- ⚡ Real-time features and subscriptions

See the [full roadmap](./docs/ROADMAP.md) for detailed plans.

## 📞 Support

- 📖 [Documentation](https://yamajs.org)
- 💬 [GitHub Discussions](https://github.com/betagors/yamajs/discussions)
- 🐛 [Issue Tracker](https://github.com/betagors/yamajs/issues)

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/BetagorsLabs">Betagors Labs</a>
</div>
