# Yama CLI Usage

There are several ways to run the Yama CLI, similar to how Maven uses `mvn`:

## Option 1: Using pnpm script (Recommended for development)

From the root of the monorepo:
```bash
pnpm yama <command>
```

From the example project:
```bash
cd examples/todo-api
pnpm yama <command>
```

## Option 2: Using wrapper scripts

### Windows (PowerShell/CMD)
From the project root:
```powershell
.\yama.cmd <command>
# or in PowerShell
.\yama.ps1 <command>
```

**Note**: PowerShell requires `.\` prefix for security. You can also add the project root to your PATH if you want to use `yama` directly.

### Unix/Linux/Mac
```bash
./yama.sh <command>
# or make it executable and add to PATH
chmod +x yama.sh
./yama.sh <command>
```

## Option 3: Direct node execution

From the root:
```bash
node packages/cli/dist/cli/src/cli.js <command>
```

From example project:
```bash
node ../../packages/cli/dist/cli/src/cli.js <command>
```

## Option 4: Global installation (for production)

Once published, you can install globally:
```bash
npm install -g @betagors/yama-cli
yama <command>
```

## Examples

```bash
# Check migration status
pnpm yama migration:status

# Generate migration
pnpm yama migration:generate

# Apply migrations
pnpm yama migration:apply

# Check schema sync
pnpm yama migration:check

# View migration history
pnpm yama migration:history
```

## Notes

- The `pnpm yama` script is the easiest way during development
- Wrapper scripts (`.cmd`, `.ps1`, `.sh`) work from the project root
- Make sure to build the CLI first: `pnpm build:packages` or `cd packages/cli && pnpm build`

