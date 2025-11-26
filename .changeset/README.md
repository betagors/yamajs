# Changesets

This project uses [Changesets](https://github.com/changesets/changesets) for version management and publishing.

## How to Use Changesets

### Creating a Changeset

When you make changes that should be published, create a changeset:

```bash
pnpm changeset
```

This will:
1. Ask which packages you've changed
2. Ask what type of change (major, minor, or patch)
3. Ask for a description of the change
4. Create a markdown file in `.changeset/` with your changes

### Version Bumping

After changesets are created and merged, run:

```bash
pnpm changeset:version
```

This will:
- Update package versions based on changesets
- Update CHANGELOG.md files
- Remove consumed changeset files

### Publishing

To publish packages to npm:

```bash
pnpm changeset:publish
```

**Note:** Publishing typically happens automatically via GitHub Actions when changesets are merged to the main branch.

## Version Types

- **Major** (`major`): Breaking changes
- **Minor** (`minor`): New features (backward compatible)
- **Patch** (`patch`): Bug fixes (backward compatible)

## Workflow

1. Make your changes
2. Run `pnpm changeset` to document the change
3. Commit the changeset file along with your code
4. Push to your branch and create a PR
5. After merging to main, a version PR will be created automatically
6. Merge the version PR to trigger publishing

## Checking Setup

Run the diagnostic script to verify everything is configured correctly:

```bash
pnpm check:publishing
```

