# Yama Monorepo Restructuring Plan

> **Status**: Draft  
> **Created**: 2025-12-18  
> **Purpose**: Align the current package layout with the authoritative classification rules

---

## Executive Summary

The Yama monorepo currently uses a **flat package structure** (`packages/postgres/`, `packages/redis/`). The authoritative rules mandate a **grouped structure by category** (`packages/adapters/db-postgres/`).

This document provides:
1. An audit of the current state
2. Identified dependency violations
3. A phased migration plan

---

## 1. Current State Audit

### Package Inventory

| Current Package | npm Name | Current Classification | Correct Classification | Violation? |
|-----------------|----------|------------------------|------------------------|------------|
| `kernel/` | `@yamajs/kernel` | Kernel | **Kernel** ✅ | No |
| `errors/` | `@yamajs/errors` | Kernel | **Kernel** ✅ | No |
| `logging/` | `@yamajs/plugin-logging` | ⚠️ Plugin | **Kernel** (core) + **Adapters** (transports) | **YES** |
| `cache/` | `@yamajs/cache` | Provider | **Provider** ✅ | No |
| `storage/` | `@yamajs/storage` | Provider | **Provider** ✅ | No |
| `postgres/` | `@yamajs/db-postgres` | Adapter | **Adapter** ✅ | No |
| `pglite/` | `@yamajs/db-pglite` | Adapter | **Adapter** ✅ | No |
| `redis/` | `@yamajs/cache-redis` | Adapter | **Adapter** ✅ | No |
| `s3/` | `@yamajs/storage-s3` | Adapter | **Adapter** ✅ | No |
| `fs/` | - | Adapter | **Adapter** ✅ | No |
| `smtp/` | - | Adapter | **Adapter** ✅ | No |
| `transporter-rest/` | - | Transport | **Transport** ✅ | No |
| `runtime-node/` | `@yamajs/runtime-node` | Runtime | **Runtime** ⚠️ | **YES** (deps) |
| `server-fastify/` | `@yamajs/server-fastify` | Host Binding | **Host Binding** ✅ | No |
| `openapi/` | `@yamajs/plugin-openapi` | Codegen | **Codegen** ✅ | No |
| `cli/` | - | CLI | **CLI** ✅ | No |
| `security/` | `@yamajs/plugin-security` | Plugin | **Plugin** ✅ | No |
| `health/` | - | Plugin | **Plugin** ✅ | No |
| `metrics/` | - | Plugin | **Plugin** ✅ | No |

---

## 2. Dependency Violations Found

### 2.1 🚨 CRITICAL: `runtime-node` has illegal dependencies

```
runtime-node depends on:
  ├── @yamajs/plugin-openapi   ← ❌ ILLEGAL (runtime → codegen)
  ├── @yamajs/db-postgres      ← ❌ ILLEGAL (runtime → adapter)
  └── @yamajs/server-fastify   ← ❌ ILLEGAL (runtime → host)
```

**Rule:** `runtime → kernel` ONLY

**Fix:** Runtime should NOT bundle adapters, hosts, or plugins. These should be composed at the application level.

---

### 2.2 ⚠️ WARNING: `logging` package is misclassified

The `@yamajs/plugin-logging` package contains:
- Logger core (contracts, levels, context) → **Kernel**
- Console/File/S3 transports → **Adapters**

**Rule:** Logging core is Kernel; log outputs are Adapters

**Fix:** Split the package:
- `packages/kernel/` should contain the Logger interface
- `packages/adapters/log-transport-console/`
- `packages/adapters/log-transport-file/`
- `packages/adapters/log-transport-s3/`

---

### 2.3 ⚠️ WARNING: Missing Provider Contracts

Several adapters exist without explicit provider interfaces:

| Adapter | Missing Provider |
|---------|-----------------|
| `db-postgres`, `db-pglite` | `providers/db` |
| `smtp` | `providers/email` |

Currently, the database and email contracts are embedded in `kernel`. They should be extracted to `providers/`.

---

## 3. Restructuring Plan

### Phase 1: Fix Critical Dependency Violations (IMMEDIATE)

**Goal:** Remove illegal imports from `runtime-node`

**Changes:**
1. Remove `@yamajs/plugin-openapi` from `runtime-node/package.json`
2. Remove `@yamajs/db-postgres` from `runtime-node/package.json`
3. Remove `@yamajs/server-fastify` from `runtime-node/package.json`
4. Create a separate "starter" or "preset" package for convenience bundles

**Impact:** Breaking change for users who relied on runtime-node bundling everything

---

### Phase 2: Extract Provider Interfaces (SHORT-TERM)

**Goal:** Create explicit provider packages

**New Packages:**
```
packages/providers/
├── db/           # Database provider interface
├── email/        # Email provider interface  
└── auth/         # Authentication provider interface
```

**Changes:**
1. Move DB interfaces from `kernel` to `providers/db`
2. Move Email interfaces from `kernel` to `providers/email`
3. Update adapters to import from providers

---

### Phase 3: Split Logging Package (SHORT-TERM)

**Goal:** Separate kernel-level logging from transport adapters

**Changes:**
1. Logger core stays in `kernel` (already done via `@yamajs/logging` in kernel deps)
2. Rename/repurpose `@yamajs/plugin-logging` to be a convenience plugin that bundles transports
3. Create separate adapter packages for each transport

---

### Phase 4: Reorganize Directory Structure (LONG-TERM)

**Goal:** Match canonical grouped structure

**Current:**
```
packages/
├── postgres/
├── pglite/
├── redis/
├── s3/
```

**Target:**
```
packages/
├── adapters/
│   ├── db-postgres/
│   ├── db-pglite/
│   ├── cache-redis/
│   └── storage-s3/
```

**Note:** npm package names can remain unchanged (`@yamajs/db-postgres`). Only the directory structure changes.

---

## 4. Migration Compatibility

### Package Names
Package names under `@yamajs/*` do NOT need to change. The npm registry is decoupled from directory structure.

| Directory | npm Package |
|-----------|-------------|
| `packages/adapters/db-postgres/` | `@yamajs/db-postgres` |
| `packages/host/http-fastify/` | `@yamajs/server-fastify` |

### Breaking Changes
- Phase 1 is breaking (removes bundled deps from runtime)
- Phase 2-4 are non-breaking (internal restructuring)

---

## 5. Recommended Immediate Actions

### Action 1: Fix `runtime-node` Dependencies

```diff
// packages/runtime-node/package.json
  "dependencies": {
    "@yamajs/errors": "workspace:*",
    "bcryptjs": "^2.4.3",
    "js-yaml": "^4.1.1",
    "dotenv": "^16.4.5",
-   "@yamajs/plugin-openapi": "workspace:*",
-   "@yamajs/db-postgres": "workspace:*",
-   "@yamajs/server-fastify": "workspace:*",
    "@yamajs/kernel": "workspace:*"
  }
```

### Action 2: Create Documentation

Update README files to reflect the correct package categories and dependency rules.

### Action 3: Add Dependency Linting

Add a CI check that validates the dependency rules:
- Kernel packages cannot import any other Yama packages (except other kernel)
- Providers can only import kernel
- Adapters can only import providers + kernel
- etc.

---

## 6. Decision Points Requiring User Input

1. **Convenience bundles**: Should we create a `@yamajs/starter-node` package that bundles common adapters for convenience?

2. **Directory restructuring timeline**: Is the grouped directory structure (`packages/adapters/`) worth the churn, or should we keep flat structure with correct npm names?

3. **Provider extraction priority**: Should we extract DB/Email providers from kernel now, or defer until there are multiple implementations?

---

## Appendix: Dependency Graph (Allowed)

```
                    ┌──────────┐
                    │  kernel  │
                    └────┬─────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌──────────┐    ┌──────────┐
    │providers│    │ runtime  │    │ plugins  │
    └────┬────┘    └──────────┘    └────┬─────┘
         │                              │
         ▼                              │
    ┌─────────┐                         │
    │adapters │                         │
    └────┬────┘                         │
         │                              │
         └──────────────┬───────────────┘
                        │
                        ▼
                  ┌───────────┐
                  │transports │
                  └─────┬─────┘
                        │
                        ▼
                    ┌──────┐
                    │ host │
                    └───┬──┘
                        │
                        ▼
                    ┌──────┐
                    │ cli  │
                    └──────┘
```
