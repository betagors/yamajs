# Yama Marketing Assets

## Social Media Cards (OG Images)

### Main OG Image Specs
- **Size**: 1200Ã—630px
- **Background**: Black (#000000)
- **Grid**: Cyan (#06b6d4) with 10% opacity
- **Content**:
  - Logo + "Yama" text (top left)
  - Main headline: "Backend APIs in 80 lines"
  - Subheading: "90% less code. 100% of the power."
  - Code snippet preview (YAML + TypeScript)
  - Bottom: "yamajs.com"

### Twitter Card
Same as OG image but optimized for Twitter's display

## Badges for README

### Built with Yama
```markdown
[![Built with Yama](https://img.shields.io/badge/Built%20with-Yama-00b6d4?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMiAxMkwxMiAyMkwyMiAxMkwxMiAyWiIgc3Ryb2tlPSIjMDZiNmQ0IiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz4KPC9zdmc+)](https://yamajs.com)
```

### Version Badge
```markdown
[![Yama Version](https://img.shields.io/npm/v/@yamajs/cli?label=yama&color=00b6d4)](https://www.npmjs.com/package/@yamajs/cli)
```

### License
```markdown
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL_2.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0)
```

### GitHub Stars
```markdown
[![GitHub stars](https://img.shields.io/github/stars/betagors/yamajs?style=social)](https://github.com/betagors/yamajs)
```

## Favicon Pack

All favicons should be generated from the Yama logo with:
- Background: Black
- Icon: Cyan gradient (#06b6d4 â†’ #22c55e)

Files needed:
- `favicon.ico` (16Ã—16, 32Ã—32, 48Ã—48)
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png` (180Ã—180)
- `android-chrome-192x192.png`
- `android-chrome-512x512.png`

## humans.txt

Located at `/public/humans.txt`:

```
/* TEAM */
Creator: Betagors
Location: [Your Location]
GitHub: https://github.com/betagors

/* THANKS */
Framework: Next.js
UI: Tailwind CSS + shadcn/ui
Inspiration: Drizzle ORM, Hono, tRPC

/* SITE */
Last update: 2025/12/09
Language: English
Standards: HTML5, CSS3, ES2024
Components: React 19, TypeScript 5
```

## security.txt

Located at `/.well-known/security.txt`:

```
Contact: mailto:security@yamajs.com
Contact: https://github.com/betagors/yamajs/security/advisories/new
Preferred-Languages: en
Canonical: https://yamajs.com/.well-known/security.txt
Policy: https://github.com/betagors/yamajs/security/policy
```

## Demo Video Script (90 seconds)

**0-15s**: Problem
"Building a production backend today means writing thousands of lines of boilerplate..."
[Screen: messy Express/NestJS codebase]

**15-30s**: Solution
"What if you could describe your entire API in 80 lines?"
[Screen: Clean yama.yaml file]

**30-45s**: Demo
"Watch this: YAML config + TypeScript handler = Full CRUD API"
[Screen: Split view - YAML left, generated API right]

**45-60s**: Features
"Auto-generated OpenAPI, type-safe SDK, JWT auth, all included"
[Screen: Swagger UI + SDK usage]

**60-75s**: Deploy
"Deploy anywhere. Fly, Railway, Docker, VPS..."
[Screen: fly deploy command]

**75-90s**: CTA
"Start building in under 15 seconds. npm create yama@latest"
[Screen: GitHub stars + yamajs.com]

## Twitter/X Thread Template

ðŸ§µ Thread for launch:

1/ ðŸš€ Just launched Yama JS - the backend framework that removes 90% of the code

Full CRUD API with auth, docs, and type-safe SDKs in ~80 lines

No more boilerplate. No more config hell. Just ship. ðŸ”¥

[Link + screenshot]

2/ Here's what you get out of the box:
âœ… Auto-generated OpenAPI spec
âœ… Type-safe client SDK
âœ… JWT authentication
âœ… PostgreSQL support
âœ… Database migrations
âœ… Docker setup
âœ… CI/CD config

All from a single YAML file + handlers

3/ Compare this to Express/NestJS:

Yama: 80 lines
Express: 400+ lines
NestJS: 500+ lines

Same functionality. 80% less code. ðŸ¤¯

[Comparison table image]

4/ The secret? Configuration-first architecture

Define structure in YAML â†’ Write logic in TypeScript â†’ Deploy anywhere

The framework handles routing, validation, docs, and SDK generation

5/ Example: Building a Todo API

[Code screenshot: yama.yaml + handler]

That's it. You now have:
- Full CRUD
- OpenAPI docs
- Type-safe client
- JWT auth

Ready to deploy.

6/ It runs everywhere:
ðŸ³ Docker
âœˆï¸ Fly.io
ðŸš‚ Railway
ðŸ–¥ï¸ Any VPS
â˜ï¸ AWS/GCP/Azure

Zero lock-in. 100% open source. MPL-2.0 licensed.

7/ Try it now:

```bash
npm create yama@latest
```

Docs: yamajs.com
GitHub: github.com/betagors/yamajs

If you build something cool, tag me! ðŸ™

RT to help indie devs ship faster ðŸš€

## Press Kit

**One-liner**: The backend framework that removes 90% of the code while keeping 100% of the power.

**Elevator pitch**: Yama is a configuration-first backend platform that turns YAML configs into production-ready APIs with auto-generated OpenAPI specs, type-safe SDKs, and built-in auth. Write 80 lines instead of 800.

**Key stats**:
- ~80 lines for full CRUD + auth (vs 400-500 in traditional frameworks)
- Auto-generated OpenAPI + Swagger UI
- Type-safe client SDK out of the box
- Runs anywhere (Docker, Fly, Railway, VPS)
- 100% open source (MPL-2.0)
- Zero vendor lock-in

**Target audience**: 
- Indie hackers building SaaS products
- Startup teams shipping MVPs fast
- Developers tired of boilerplate
- API-first companies

**What makes it different**:
1. Configuration-first (structure in YAML, logic in TS)
2. Auto-generates everything (OpenAPI, SDK, types)
3. Batteries included (auth, migrations, Docker)
4. Zero lock-in (it's just Node.js + PostgreSQL)

**Founder story**: Built by an indie developer frustrated with writing the same boilerplate for every new project. After the 50th time setting up Express + TypeORM + Swagger, decided there had to be a better way.
