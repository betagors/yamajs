# Testing Setup Guide

## Prerequisites

1. **PostgreSQL Database**: Make sure PostgreSQL is running
2. **Node.js**: Version 18 or higher
3. **pnpm**: Package manager

## Setup Steps

### 1. Install Dependencies

```bash
# From monorepo root
pnpm install

# Build all packages
pnpm build
```

### 2. Configure Environment

Copy the example env file and fill in your values:

```bash
cd examples/todo-api
cp .env.example .env
```

Edit `.env` with your database connection:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/todo_db
JWT_SECRET=your-secret-key-here
```

### 3. Generate Code

Generate TypeScript types, Drizzle schemas, and mappers:

```bash
yama generate
```

This will create:
- `src/types.ts` - API types
- `src/generated/db/schema.ts` - Drizzle table definitions
- `src/generated/db/mapper.ts` - Entity-to-schema mappers

### 4. Create Database Migration

Generate and review the migration:

```bash
yama db:migrate create_todos_table
```

This creates a SQL file in `migrations/` directory.

### 5. Apply Migration

Apply the migration to create tables:

```bash
yama db:migrate:apply
```

### 6. Check Migration Status

Verify migrations are applied:

```bash
yama db:migrate:status
```

### 7. Start Development Server

Start the server with auto-reload:

```bash
yama dev
```

The server will:
- Load `.env` file automatically
- Connect to database
- Start on http://localhost:4000

## Testing Endpoints

### Health Check

```bash
curl http://localhost:4000/health
```

### Get All Todos

```bash
curl http://localhost:4000/todos
```

### Create Todo

```bash
curl -X POST http://localhost:4000/todos \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Todo", "completed": false}'
```

### Get Todo by ID

```bash
curl http://localhost:4000/todos/{id}
```

### Update Todo

```bash
curl -X PUT http://localhost:4000/todos/{id} \
  -H "Content-Type: application/json" \
  -d '{"completed": true}'
```

### Delete Todo

```bash
curl -X DELETE http://localhost:4000/todos/{id}
```

## API Documentation

Visit http://localhost:4000/docs for Swagger UI documentation.

## Troubleshooting

### Database Connection Error

- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in `.env` is correct
- Ensure database exists: `createdb todo_db`

### Migration Errors

- Check migration status: `yama db:migrate:status`
- Review migration SQL files in `migrations/`
- Ensure database user has CREATE TABLE permissions

### Type Errors

- Regenerate types: `yama generate`
- Rebuild packages: `pnpm build`

