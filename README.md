# **Yama JS — Project Description**

**Yama JS** is an open-source, configuration-first backend platform designed to turn YAML into fully functional APIs, SDKs, and documentation. It combines strict structural config with clean TypeScript service code and deterministic AI workflows, enabling teams to build apps faster, safer, and without drowning in boilerplate.

Yama separates **structure** from **logic**:

* **Structure** lives in YAML (schemas, endpoints, auth rules, behaviors)
* **Logic** lives in TypeScript handlers
* **Platform** handles everything else (routing, validation, generation, docs, consistency)

This approach dramatically reduces AI token usage, prevents hallucinations, eliminates boilerplate, and avoids the expensive “senior engineer required for safety” trap of typical AI code generation.

Yama JS eventually evolves into a **full-stack AI-assisted app builder**, with:

* Backend-as-config
* Frontend-as-config (“vibe config”)
* AI generating consistent schemas, flows, and wiring
* Deterministic codegen instead of chaotic AI improvisation
* Open-source core everyone can inspect and contribute to
* A hosted cloud platform for deployment, scaling, auth, logs, and team features

The philosophy is simple:

* **YAML defines the contract**
* **Code defines custom behavior**
* **Yama guarantees correctness, safety, and consistency**

The long-term goal is to provide:

* A backend runtime
* A code generator
* A documentation engine
* A configurable frontend system
* AI tooling that’s safe, predictable, and cheap
* A cloud platform for hosting apps built on Yama
* A community-driven ecosystem where users own their apps

Yama is built as a **pnpm + Turborepo monorepo** under the Betagors Labs organization, with a strict architecture to support its growth into a real developer platform.

Core values:

1. **Single source of truth**
2. **Structure over magic**
3. **Deterministic AI over hallucination**
4. **Open-source core, commercial cloud**
5. **Real developer empowerment, not drag-and-drop illusions**

## Development Plan

### Phase 1: Core Platform & Deployment (Current)

**Core Features:**
- ✅ YAML-based configuration system
- ✅ TypeScript handler system
- ✅ Database adapters (PostgreSQL)
- ✅ HTTP server adapters (Fastify)
- ✅ Schema validation and code generation
- ✅ CLI tooling

**Deployment Strategy:**
- **Phase 1.1: Serverless Deployment Support** (In Progress)
  - Create `packages/runtime-serverless` package for serverless function wrappers
  - Add serverless-compatible database connection pooling
  - Support Vercel and Netlify deployment
  - Add deployment configuration templates
  - Update database adapter to support serverless-friendly PostgreSQL clients (`@vercel/postgres`, `@neondatabase/serverless`)
  
  **Benefits:**
  - Lower barrier to entry for new users
  - Proof of production readiness
  - Competitive parity with other frameworks
  - Community growth through easy deployment
  - Foundation for future cloud platform

### Phase 2: Enhanced Features & Cloud Platform

**Platform Features:**
- Team management and collaboration
- Advanced analytics and monitoring
- Enhanced authentication providers
- Automated scaling and optimization
- Integrated logging and debugging tools

**Cloud Platform:**
- Yama Cloud (hosted platform with premium features)
- Self-hosted option remains available
- Migration path from Vercel/Netlify to Yama Cloud

### Phase 3: Full-Stack Expansion

**Frontend Integration:**
- Frontend-as-config ("vibe config")
- AI-assisted frontend generation
- Framework-specific SDKs (React, Next.js, Vue, etc.)
- Real-time features and subscriptions
