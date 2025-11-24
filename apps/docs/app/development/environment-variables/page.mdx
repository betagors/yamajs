# Environment Variables

Yama supports environment-specific configuration files for managing different environments (development, staging, production, etc.).

## How It Works

Environment variables are loaded in the following priority order (later files override earlier ones):

1. **`.env`** - Base/default values (committed to git)
2. **`.env.{environment}`** - Environment-specific overrides (e.g., `.env.development`, `.env.production`)
3. **`.env.local`** - Local overrides (highest priority, usually gitignored)

## Setting the Environment

The environment is determined in this order:
1. `--env` flag in CLI commands (e.g., `yama dev --env production`)
2. `NODE_ENV` environment variable
3. Defaults to `development`

## Usage Examples

### Development
```bash
# Uses .env and .env.development (if exists)
yama dev

# Or explicitly specify
yama dev --env development
```

### Production
```bash
# Uses .env and .env.production (if exists)
NODE_ENV=production yama dev

# Or use the flag
yama dev --env production
```

### Staging
```bash
yama dev --env staging
```

## File Structure

```
your-project/
├── .env                    # Base configuration (committed)
├── .env.development        # Development overrides (committed)
├── .env.production         # Production overrides (committed)
├── .env.staging            # Staging overrides (committed)
└── .env.local              # Local overrides (gitignored)
```

## Example Files

### `.env` (Base)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/myapp_db
JWT_SECRET=base-secret-key
PORT=4000
```

### `.env.development`
```env
DATABASE_URL=postgresql://user:password@localhost:5432/myapp_dev
JWT_SECRET=dev-secret-key
```

### `.env.production`
```env
DATABASE_URL=postgresql://user:password@prod-host:5432/myapp_prod
JWT_SECRET=CHANGE_THIS_TO_STRONG_SECRET
```

### `.env.local` (Gitignored)
```env
# Personal local overrides
DATABASE_URL=postgresql://localhost:5432/my_local_db
JWT_SECRET=my-personal-dev-key
```

## Using Environment Variables in yama.yaml

You can reference environment variables in your `yama.yaml` using `${VAR_NAME}` syntax:

```yaml
database:
  url: ${DATABASE_URL}

auth:
  providers:
    - type: jwt
      secret: ${JWT_SECRET}
```

## Best Practices

1. **Never commit secrets**: Use `.env.local` for sensitive values or use a secrets manager
2. **Use environment-specific files**: Create `.env.development`, `.env.production`, etc. for different environments
3. **Keep base values in `.env`**: Common values that don't change between environments
4. **Document required variables**: List required environment variables in your README
5. **Use `.env.example`**: Create example files showing the structure without actual secrets

## Supported Commands

The following commands support the `--env` flag:
- `yama dev --env <environment>` - Start dev server with specific environment
- `yama schema:check --env <environment>` - Check schema for specific environment
- `yama schema:apply --env <environment>` - Apply migrations for specific environment
- `yama schema:status --env <environment>` - Check migration status for specific environment
- `yama schema:history --env <environment>` - Show migration history for specific environment

