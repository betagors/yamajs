---
description: Package classification and dependency rules for Yama monorepo
---

# Yama Monorepo — Package Classification & Dependency Rules (Authoritative)

## 1. Fundamental Axes

Yama is organized by **axis of responsibility**, not by feature.

There are **7 package categories**:

| Category | Description |
|----------|-------------|
| **Kernel** | Core Invariants |
| **Providers** | Capabilities / Contracts |
| **Adapters** | Concrete Implementations |
| **Transports** | Protocol Surfaces |
| **Runtime** | Execution Environment |
| **Host Bindings** | Invocation & Lifecycle Entry Points |
| **Plugins** | Optional Extensions |

**Every package MUST belong to exactly one category.**
If more than one applies, the design is wrong.

---

## 2. Canonical Monorepo Structure (MANDATORY)

```
repo/
├─ packages/
│  ├─ kernel/
│  │   ├─ core/            # YAML → IR, registry, validation
│  │   ├─ ir/              # IR spec, serializers (FROZEN)
│  │   ├─ logging/         # Logger, ctx.log, levels, redaction
│  │   ├─ errors/          # Canonical error types
│  │   └─ config/          # Env + YAML resolution
│  │
│  ├─ providers/
│  │   ├─ db/
│  │   ├─ cache/
│  │   ├─ storage/
│  │   ├─ email/
│  │   └─ auth/
│  │
│  ├─ adapters/
│  │   ├─ db-postgres/
│  │   ├─ db-pglite/
│  │   ├─ cache-redis/
│  │   ├─ cache-memory/
│  │   ├─ storage-fs/
│  │   ├─ storage-s3/
│  │   └─ log-transport-otel/
│  │
│  ├─ transports/
│  │   ├─ http-rest/
│  │   ├─ graphql/
│  │   ├─ mcp/
│  │   └─ webhooks/
│  │
│  ├─ runtime/
│  │   ├─ env-node/        # Reference runtime environment
│  │   ├─ env-edge/
│  │   └─ env-python/      # later
│  │
│  ├─ host/
│  │   ├─ http-fastify/
│  │   ├─ http-hono/
│  │   ├─ http-express/
│  │   └─ mcp-stdio/
│  │
│  ├─ plugins/
│  │   ├─ rate-limit/
│  │   ├─ audit/
│  │   └─ auth-rbac/
│  │
│  ├─ codegen/
│  │   ├─ openapi/
│  │   ├─ sdk/
│  │   └─ docs/
│  │
│  └─ cli/
│
├─ apps/
│  ├─ examples/
│  └─ playground/
│
├─ docs/
├─ tooling/
└─ README.md
```

---

## 3. Package Classification Rules

### 3.1 Kernel (`packages/kernel/*`)

**Definition:** Core invariants required by every Yama app.

**Characteristics:**
- Cannot be disabled
- Cannot depend on anything else
- Defines contracts and rules, never infrastructure

**Examples:** IR definition, Logging core, Error taxonomy, YAML validation

**Rule:** If removing it breaks all apps → **Kernel**

---

### 3.2 Providers (`packages/providers/*`)

**Definition:** Abstract capabilities exposed to user code via `ctx`.

**Characteristics:**
- Interface-only
- Exactly one active implementation at runtime
- User-visible semantics (`ctx.db`, `ctx.cache`)

**Examples:** Database, Cache, Storage, Email

**Rule:** If user code calls it and semantics matter → **Provider**

---

### 3.3 Adapters (`packages/adapters/*`)

**Definition:** Concrete implementations of providers or kernel extension points.

**Characteristics:**
- Replaceable
- Infrastructure-specific
- Not exposed directly to user code

**Examples:** PostgreSQL, Redis, S3, OpenTelemetry log sink

**Rule:** If it implements a provider or kernel interface → **Adapter**

---

### 3.4 Transports (`packages/transports/*`)

**Definition:** Protocol surfaces exposing IR operations externally.

**Characteristics:**
- Same semantics, different shapes
- Multiple can coexist
- No business logic ownership

**Examples:** REST (HTTP), GraphQL, MCP, Webhooks

**Rule:** If it maps IR → external protocol → **Transport**

🚫 Transports do not own logic  
🚫 Transports do not modify IR

---

### 3.5 Runtime (`packages/runtime/*`)

**Definition:** Execution environments where Yama runs.

**Characteristics:**
- Bind OS / platform primitives
- Define global execution semantics
- Do not expose entry points

**Examples:** Node, Edge, Python

**Rule:** If it binds OS/platform capabilities → **Runtime**

---

### 3.6 Host Bindings (`packages/host/*`)

**Definition:** Invocation and lifecycle entry points that connect the outside world to Yama.

**Characteristics:**
- Accept external invocations (HTTP, stdio, WS)
- Translate requests into Yama execution
- May own lifecycle, but do not define runtime

**Examples:** Fastify HTTP server, Hono HTTP server, Express HTTP server, MCP stdio server

**Rule:** If it accepts requests and maps them into Yama's execution pipeline → **Host Binding**

---

### 3.7 Plugins (`packages/plugins/*`)

**Definition:** Optional extensions that add behavior.

**Characteristics:**
- Opt-in
- Declarative activation
- Never required

**Examples:** Rate limiting, Auditing, Metrics

**Rule:** If it extends behavior without redefining contracts → **Plugin**

---

## 4. Dependency Rules (STRICT)

Allowed import directions **ONLY**:

```
kernel → nothing
providers → kernel
adapters → providers → kernel
transports → kernel + providers
runtime → kernel
host → runtime + transports + providers
plugins → kernel + providers
cli → everything (read-only)
```

🚫 No circular imports  
🚫 No adapters importing runtime or host  
🚫 No providers importing adapters  
🚫 No plugins modifying IR

---

## 5. Logging Special Rule

- **Logging core** is Kernel
- **Log outputs** (console, fs, s3, otel) are Adapters
- `ctx.log` is a restricted facade
- Users never control log transports directly

---

## 6. Decision Checklist

Before creating a package, answer:

| Question | Category |
|----------|----------|
| Does this define a contract? | Kernel / Provider |
| Does this implement a contract? | Adapter |
| Does this expose Yama externally? | Transport |
| Does this bind OS/platform primitives? | Runtime |
| Does this accept requests and start execution? | Host Binding |
| Is it optional behavior? | Plugin |

**If more than one answer applies → stop and redesign.**

---

## 7. Non-Negotiable Principles

1. **Determinism** over flexibility
2. **Structure** over convenience
3. **One responsibility** per package
4. **No semantic duplication**
5. **No "temporary" architecture**

---

## 8. AI Agent Instructions

When unsure, **do not guess**.

Propose the package category explicitly and justify it before writing code.
