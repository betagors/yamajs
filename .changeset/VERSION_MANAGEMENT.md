# How Changesets Manages Package Versions

## Current State

All packages currently have version: `0.1.0-alpha.0`

## How Version Updates Work

### 1. When You Create a Changeset

When you run `pnpm changeset`, you specify:
- **Which packages** changed
- **What type of change** (major/minor/patch)
- **Description** of the change

Example: If you change `@yamajs/core` with a patch:
- Changeset file created: `.changeset/abc123-patch-core.md`
- No version changes yet (happens later)

### 2. When You Run `pnpm changeset:version`

This is where versions get updated:

#### For Changed Packages
- **Patch change** â†’ `0.1.0-alpha.0` â†’ `0.1.0-alpha.1`
- **Minor change** â†’ `0.1.0-alpha.0` â†’ `0.1.1-alpha.0`
- **Major change** â†’ `0.1.0-alpha.0` â†’ `1.0.0-alpha.0`

#### For Dependent Packages (Automatic Updates)
Your config has `"updateInternalDependencies": "patch"`, which means:

If `@yamajs/core` gets a **patch** update:
- `@yamajs/cli` (depends on core) â†’ gets a **patch** bump
- `@yamajs/postgres` (depends on core) â†’ gets a **patch** bump
- `@yamajs/fastify` (depends on core) â†’ gets a **patch** bump
- All packages that depend on core get bumped automatically

If `@yamajs/core` gets a **minor** update:
- Dependent packages get **patch** bumps (because of config setting)

If `@yamajs/core` gets a **major** update:
- Dependent packages get **patch** bumps (because of config setting)

### 3. Workspace Dependencies

Your packages use `workspace:*` for internal dependencies:

```json
{
  "dependencies": {
    "@yamajs/core": "workspace:*"
  }
}
```

When versions are updated:
- Changesets automatically updates `workspace:*` to `workspace:^0.1.0-alpha.1` (or new version)
- This ensures published packages reference correct versions

### 4. Example Scenario

**Starting state:**
- `@yamajs/core`: `0.1.0-alpha.0`
- `@yamajs/cli`: `0.1.0-alpha.0` (depends on core)
- `@yamajs/postgres`: `0.1.0-alpha.0` (depends on core)

**You make a patch change to core:**
1. Run `pnpm changeset` â†’ select core, patch
2. Run `pnpm changeset:version`

**Result:**
- `@yamajs/core`: `0.1.0-alpha.1` âœ… (your change)
- `@yamajs/cli`: `0.1.0-alpha.1` âœ… (auto-bumped because depends on core)
- `@yamajs/postgres`: `0.1.0-alpha.1` âœ… (auto-bumped because depends on core)
- `@yamajs/cli/package.json`: `"@yamajs/core": "workspace:^0.1.0-alpha.1"` âœ… (updated)

### 5. Version Progression Examples

**Alpha/Beta/RC Releases:**
- `0.1.0-alpha.0` â†’ `0.1.0-alpha.1` (patch in alpha)
- `0.1.0-alpha.9` â†’ `0.1.1-alpha.0` (minor in alpha)
- `0.1.0-alpha.0` â†’ `1.0.0-alpha.0` (major in alpha)

**Stable Releases:**
- `0.1.0-alpha.0` â†’ `0.1.0` (first stable release)
- `0.1.0` â†’ `0.1.1` (patch)
- `0.1.0` â†’ `0.2.0` (minor)
- `0.1.0` â†’ `1.0.0` (major)

### 6. What Gets Updated

When `pnpm changeset:version` runs:
- âœ… Package `version` fields in `package.json`
- âœ… `workspace:*` dependencies â†’ `workspace:^X.Y.Z`
- âœ… CHANGELOG.md files (created/updated)
- âœ… Changeset files removed (consumed)

### 7. Publishing

When you run `pnpm changeset:publish`:
- Only packages with version bumps get published
- Uses the version from `package.json`
- Tags are created: `@yamajs/core@0.1.0-alpha.1`

## Configuration Impact

Your `.changeset/config.json` settings:

- `"updateInternalDependencies": "patch"` â†’ Dependents always get patch bumps
- `"access": "public"` â†’ Packages publish to public npm registry
- `"baseBranch": "main"` â†’ Version PRs created when merged to main
- `"ignore": ["@yamajs/docs-site"]` â†’ Docs site package never gets versioned

## Summary

**Versions are managed automatically:**
1. You create changesets describing changes
2. `changeset:version` bumps versions based on changesets
3. Dependent packages get auto-bumped
4. Workspace dependencies get updated
5. CHANGELOGs are generated
6. Ready to publish!

