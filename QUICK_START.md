# Quick Start Guide

## Environment Variables & Testing Setup

### 1. Install Dependencies & Build

```bash
# Install all dependencies
pnpm install

# Build all packages (required before first use)
pnpm build
```

### 2. Setup Environment File

Create `.env` file in `examples/todo-api/`:

```bash
cd examples/todo-api
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/todo_db
JWT_SECRET=your-secret-key-here
```

### 3. Generate Code

```bash
# From examples/todo-api directory
yama generate
```

This generates:
- `src/types.ts` - TypeScript types
- `src/generated/db/schema.ts` - Drizzle schemas
- `src/generated/db/mapper.ts` - Entity mappers

### 4. Setup Database

```bash
# Create migration
yama db:migrate create_todos_table

# Apply migration
yama db:migrate:apply

# Check status
yama db:migrate:status
```

### 5. Start Server

```bash
yama dev
```

Server starts on http://localhost:4000

### 6. Test API

```bash
# Run test script
node test.js

# Or manually test
curl http://localhost:4000/health
curl http://localhost:4000/todos
```

## Environment Variable Support

- `.env` files are automatically loaded
- Supports `${VAR_NAME}` syntax in yama.yaml
- Looks for `.env` or `.env.local` files
- Searches up directory tree from config file location
- Existing `process.env` variables take precedence

## What Was Added

1. **Environment File Support** (`packages/core/src/env.ts`)
   - `loadEnvFile()` - Loads .env files
   - `resolveEnvVar()` - Resolves ${VAR} syntax
   - `resolveEnvVars()` - Recursively resolves env vars in objects

2. **Runtime Integration**
   - Automatically loads .env before parsing config
   - Resolves environment variables in config values

3. **CLI Integration**
   - `yama dev` - Loads .env automatically
   - `yama db:migrate:apply` - Loads .env for database connection
   - `yama db:migrate:status` - Loads .env for database connection

4. **Testing Tools**
   - `test.js` - Node.js test script
   - `test.sh` - Bash test script
   - `test-setup.md` - Detailed testing guide

## Troubleshooting

### "Module not found" errors
- Run `pnpm build` to compile packages

### Database connection errors
- Check PostgreSQL is running
- Verify DATABASE_URL in .env
- Ensure database exists

### Type errors
- Run `yama generate` to regenerate types
- Run `pnpm build` to rebuild packages

