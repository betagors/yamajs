# Yama JS

> **Configuration-first backend platform** that turns YAML into fully functional APIs, SDKs, and documentation.

[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org/)

Yama separates **structure** from **logic**:
- **Structure** lives in YAML (schemas, endpoints, auth rules, behaviors)
- **Logic** lives in TypeScript handlers
- **Platform** handles everything else (routing, validation, generation, docs, consistency)

This approach dramatically reduces boilerplate, prevents AI hallucinations, and enables teams to build apps faster and safer.

## ✨ Features

- 🎯 **YAML-First Configuration** - Define your entire API structure in `yama.yaml`
- 🚀 **Type-Safe TypeScript** - Auto-generated types and SDKs from your config
- 🔌 **Plugin System** - Extensible architecture with database and HTTP adapters
- 📚 **Auto-Generated Docs** - OpenAPI documentation generated from your config
- 🛠️ **Powerful CLI** - Development server, code generation, and migration tools
- 🔒 **Built-in Auth** - JWT authentication and authorization rules
- 🗄️ **Database Support** - PostgreSQL and PGLite adapters with migrations
- ⚡ **Fast Development** - Hot reload, watch mode, and instant feedback

## 🚀 Quick Start

### Installation

```bash
npm install -g @betagors/yama-cli
```

### Create a New Project

```bash
yama create my-api
cd my-api
npm install
```

### Start Development Server

```bash
yama dev
```

Your API will be running at `http://localhost:4000` 🎉

## 📖 Basic Usage

### 1. Define Your API in `yama.yaml`

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

endpoints:
  /todos:
    get:
      handler: handlers/listTodos
      response:
        type: array
        items:
          $ref: "#/schemas/Todo"
    post:
      handler: handlers/createTodo
      request:
        $ref: "#/schemas/Todo"
      response:
        $ref: "#/schemas/Todo"
```

### 2. Write Your Handlers

```typescript
// src/handlers/listTodos.ts
import { HandlerContext } from '@betagors/yama-core';

export async function listTodos(context: HandlerContext) {
  // Your business logic here
  return [
    { id: '1', title: 'Learn Yama', completed: false },
    { id: '2', title: 'Build an API', completed: true },
  ];
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

const todos = await api.todos.get();
const newTodo = await api.todos.post({ 
  title: 'New Todo',
  completed: false 
});
```

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
yama generate --watch    # Watch mode
yama types               # Generate types only
yama sdk                 # Generate SDK only
```

### Database Migrations

```bash
yama schema:generate      # Generate migration from schema
yama schema:apply         # Apply pending migrations
yama schema:status        # Check migration status
yama schema:history       # View migration history
```

### Validation

```bash
yama validate            # Validate yama.yaml
yama validate --strict   # Strict validation
yama endpoints          # List all endpoints
yama schemas            # List all schemas
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
│   ├── runtime-node/     # Node.js runtime
│   └── ...
├── apps/
│   └── docs/             # Documentation site
└── examples/             # Example projects
```

## 📚 Documentation

- [Quick Start Guide](QUICK_START.md) - Get up and running quickly
- [Contributing Guide](CONTRIBUTING.md) - How to contribute to Yama
- [CLI Usage](CLI_USAGE.md) - Detailed CLI documentation
- [Development Scripts](docs/development-scripts.md) - Development workflow

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

The documentation site (`apps/docs`) is licensed under **MIT** - see [apps/docs/LICENSE](apps/docs/LICENSE) for details.

## 🎯 Philosophy

Yama's core philosophy:

- **YAML defines the contract** - Structure is explicit and version-controlled
- **Code defines custom behavior** - Business logic stays in TypeScript
- **Yama guarantees correctness** - Type safety, validation, and consistency

## 🗺️ Roadmap

### Phase 1: Core Platform (Current)
- ✅ YAML-based configuration
- ✅ TypeScript handler system
- ✅ Database adapters (PostgreSQL, PGLite)
- ✅ HTTP server adapters (Fastify)
- ✅ Schema validation and code generation
- ✅ CLI tooling

### Phase 2: Enhanced Features
- 🔄 Serverless deployment support
- 📊 Advanced analytics and monitoring
- 🔐 Enhanced authentication providers
- 🚀 Automated scaling and optimization

### Phase 3: Full-Stack Expansion
- 🎨 Frontend-as-config ("vibe config")
- 🤖 AI-assisted generation
- ⚡ Real-time features and subscriptions

## 💡 Why Yama?

- **Less Boilerplate** - Define structure once, generate everything
- **Type Safety** - End-to-end type safety from config to client
- **AI-Friendly** - Structured config reduces AI hallucinations
- **Developer Experience** - Fast iteration, hot reload, instant feedback
- **Open Source** - Transparent, extensible, community-driven

## 📞 Support

- 📖 [Documentation](https://yamajs.org)
- 💬 [GitHub Discussions](https://github.com/betagors/yama/discussions)
- 🐛 [Issue Tracker](https://github.com/betagors/yama/issues)

---

Made with ❤️ by [Betagors Labs](https://github.com/BetagorsLabs)
