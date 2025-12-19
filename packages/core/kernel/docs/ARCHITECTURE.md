# Yama Architectural Guidelines

This document defines the strict boundaries and naming conventions for the Yama ecosystem. Adhering to these rules is essential for maintaining a runtime-agnostic core and a pluggable infrastructure.

---

## 1. Components & Naming Conventions

| Component | Package Pattern | Responsibility |
|-----------|-----------------|----------------|
| **Kernel** | `@yamajs/kernel` | The main orchestration layer. Handles lifecycle and wiring. |
| **Core** | (Internal) | The "Engine" inside the Kernel. Handles Operation execution and Context. |
| **Types** | (Ambient) | Pure contract definitions used by Providers and Plugins. |
| **Runtimes** | `@yamajs/runtime-*` | Implements platform I/O (Node, Edge, Deno). |
| **Transporters** | `@yamajs/transporter-*` | Input adapters (REST, CLI, MCP). |
| **Providers** | `@yamajs/provider-*` | Infrastructure adapters (DB, Cache, Storage). |
| **Plugins** | `@yamajs/plugin-*` | Behavior extensions and schema directives. |
| **Servers** | `@yamajs/server-*` | Bridges for HTTP frameworks (Fastify, Hono). |

---

## 2. Component Instructions

### ⚪ The Kernel & Core
- **Kernel**: Manages the registry of all other components. It is the "Shell".
- **Core**: The internal execution engine. It manages the `HandlerContext` and ensures Middleware and Policies are applied.
- **Rules**:
  - Must remain **Zero-Dependency** regarding runtimes and infrastructure.
  - Must use only the `RuntimeAdapter` for I/O.

### 📄 Types & Contracts
Yama is a "Contract First" framework.
- **Convention**: Define interfaces in `packages/kernel/src/providers/types.ts`.
- **Instruction**: Providers MUST implement these types. Plugins MUST consume these types. This ensures you can swap `@yamajs/provider-postgres` for `@yamajs/provider-sqlite` without changing a single line of plugin code.

### 🔵 Runtimes
- **Instruction**: When creating a runtime, ensure you implement the full `RuntimeAdapter` interface (Env, FS, Path, Crypto, Modules).
- **Convention**: `@yamajs/runtime-node` is the reference implementation.

### 🟡 Transporters
- **Instruction**: Transporters should be "dumb". They just parse an incoming request (from a CLI flag, an HTTP body, or an MCP prompt) and call `kernel.executeOperation()`.
- **Convention**: `@yamajs/transporter-rest` is the most common.

### 🟠 Providers
- **Instruction**: A provider should only focus on I/O. For example, a Database provider should take a SQL string and return rows. It should NOT know about HTTP, Auth, or Plugins.
- **Convention**: `@yamajs/provider-{technology}`.

### 🟣 Plugins
- **Instruction**: Use the `definePlugin` helper. This ensures your plugin has the correct manifest and type safety.
- **Convention**: `@yamajs/plugin-{feature}`.

### 🔴 Servers
- **Instruction**: Servers connect a Transporter to a framework. For example, `@yamajs/server-fastify` takes the `transporter-rest` definitions and mounts them as Fastify routes.
- **Convention**: `@yamajs/server-{framework}`.

---

## 3. Strict Prohibitions

1. **No I/O in Kernel**: If you need to read a file or check an env var in the kernel, you MUST use `getRuntime().fs` or `getRuntime().env`. Never use `process` or `fs` directly.
2. **No Concrete Providers in Kernel**: The kernel `providers/` directory must contain interfaces and registries only. All `adapters/` directories in the kernel have been removed and must stay removed.
3. **No circular dependencies**: Providers can depend on Kernel, but Kernel can NEVER depend on a Provider.
4. **Naming Integrity**: Do not use "Core" for something that only works on Node. Use "Runtime-Node".
