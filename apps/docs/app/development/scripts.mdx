# Development Scripts

This document describes all available npm/pnpm scripts for developing and building the Yama JS monorepo.

## Root-Level Scripts

All scripts should be run from the repository root using `pnpm`.

### Build Scripts

#### `pnpm build`
Builds all packages and examples in the monorepo using Turborepo.

```bash
pnpm build
```

#### `pnpm build:packages`
Builds only the core packages (e.g., `@yama/core`, `@yama/runtime-node`) without building examples.

```bash
pnpm build:packages
```

This is useful when you only need to rebuild the packages that examples depend on.

#### `pnpm build:example`
Alias for `build:packages`. Builds all package dependencies required for examples.

```bash
pnpm build:example
```

### Development Scripts

#### `pnpm dev`
Runs all dev/watch tasks in parallel across the entire monorepo. This includes:
- TypeScript watch mode for all packages
- Any other dev tasks defined in package.json files

```bash
pnpm dev
```

#### `pnpm dev:packages`
Runs watch mode for all packages only (excludes examples). This is useful when you want to:
- Watch for changes in core packages
- Rebuild automatically on file changes
- Keep examples running separately

```bash
pnpm dev:packages
```

#### `pnpm dev:example`
Builds all packages first, then starts the example server. This ensures dependencies are up-to-date before running the example.

```bash
pnpm dev:example
```

**Use case:** Quick start when you want to build and run an example in one command.

#### `pnpm start:example`
Starts the example server directly (assumes packages are already built).

```bash
pnpm start:example
```

**Use case:** When packages are already built and you just want to restart the example server.

### Utility Scripts

#### `pnpm clean`
Cleans all build outputs (dist folders) across the monorepo.

```bash
pnpm clean
```

#### `pnpm clean:all`
Performs a deep clean by removing:
- All build outputs (dist folders)
- All node_modules directories (root, packages, and examples)

```bash
pnpm clean:all
```

**Use case:** When you need a completely fresh start, typically followed by:
```bash
pnpm clean:all
pnpm install
pnpm build
```

### Other Scripts

#### `pnpm lint`
Runs linting across all packages.

```bash
pnpm lint
```

#### `pnpm test`
Runs tests across all packages.

```bash
pnpm test
```

## Example Package Scripts

Scripts available in `examples/todo-api/`:

#### `pnpm dev` / `pnpm start`
Starts the development server for the todo-api example.

```bash
cd examples/todo-api
pnpm dev
```

#### `pnpm build`
Shows an informational message. Examples don't require building as they run directly from source.

## Common Workflows

### Starting Development

**Option 1: Quick start (recommended)**
```bash
pnpm dev:example
```
This builds packages and starts the example server.

**Option 2: Watch mode for active development**
```bash
# Terminal 1: Watch packages
pnpm dev:packages

# Terminal 2: Start example
pnpm start:example
```
This setup automatically rebuilds packages when you make changes, and you can restart the example server as needed.

### Making Changes to Packages

1. **Edit package source code** (e.g., `packages/runtime-node/src/index.ts`)
2. **If using watch mode:** Changes are automatically rebuilt
3. **If not using watch mode:** Run `pnpm build:packages` to rebuild
4. **Restart example server** if it's running

### Fresh Start

When you need to start completely fresh:
```bash
pnpm clean:all
pnpm install
pnpm build
```

### Testing Changes

1. Make changes to package code
2. Run `pnpm build:packages` (or use watch mode)
3. Restart the example server: `pnpm start:example`
4. Test your changes

## Package-Specific Scripts

### `@yama/core`

- `pnpm build` - Compiles TypeScript to `dist/`
- `pnpm dev` - Watch mode for TypeScript compilation
- `pnpm clean` - Removes `dist/` folder

### `@yama/runtime-node`

- `pnpm build` - Compiles TypeScript to `dist/`
- `pnpm dev` - Watch mode for TypeScript compilation
- `pnpm clean` - Removes `dist/` folder

## Tips

1. **Use watch mode during active development** - It saves time by automatically rebuilding on changes
2. **Build packages before running examples** - Ensures you're using the latest compiled code
3. **Use `clean:all` sparingly** - It removes all node_modules, which requires reinstalling dependencies
4. **Turborepo caching** - Build outputs are cached, so subsequent builds are faster

## Troubleshooting

### Example server not picking up changes
- Ensure packages are rebuilt: `pnpm build:packages`
- Restart the example server
- Check that watch mode is running if you expect automatic rebuilds

### Build errors
- Run `pnpm clean` to remove stale build artifacts
- Ensure all dependencies are installed: `pnpm install`
- Check TypeScript errors: `pnpm build` will show compilation errors

### Module not found errors
- Rebuild packages: `pnpm build:packages`
- Reinstall dependencies: `pnpm install`
- Check that workspace dependencies are correctly linked

