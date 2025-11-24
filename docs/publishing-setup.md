# Publishing Setup Guide

This guide walks you through setting up npm publishing for `@betagors/yama-*` packages.

## Prerequisites

- An npm account (create at https://www.npmjs.com/signup if needed)
- Admin access to the GitHub repository

## Step 1: Create npm Organization

1. Go to https://www.npmjs.com/org/create
2. Enter organization name: **`betagors`**
3. Choose a plan (free plan works fine)
4. Complete the organization setup

**Important:** The organization name must match your scope (`@betagors`). If you already have a user account, you can create an organization from your account settings.

## Step 2: Create Automation Token

1. Go to https://www.npmjs.com/settings/betagors/tokens
   - (Replace `betagors` with your org name if different)
2. Click **"Generate New Token"**
3. Configure the token:
   - **Type:** Select **"Automation"** (required for CI/CD)
   - **Expiration:** Choose "Never expires" or set a custom expiration
   - **Description:** e.g., "GitHub Actions publishing"
4. Click **"Generate Token"**
5. **Copy the token immediately** - you won't be able to see it again!

## Step 3: Add Token to GitHub Secrets

1. Go to your GitHub repository
2. Navigate to **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"**
4. Configure the secret:
   - **Name:** `NPM_TOKEN`
   - **Value:** Paste the token you copied in Step 2
5. Click **"Add secret"**

## Step 4: Verify Setup

The GitHub Actions workflow will now be able to publish packages when:
- You push changes to `main` branch
- You create a git tag starting with `v*`
- You manually trigger the workflow from GitHub Actions

## Testing Locally (Optional)

Before relying on CI/CD, you can test publishing locally:

```bash
# Login to npm
npm login

# Build packages
pnpm build:packages

# Publish a test package (use alpha tag for pre-releases)
cd packages/core
npm publish --access public --tag alpha
```

## Publishing Workflow

### Using Changesets (Recommended)

1. **Create a changeset:**
   ```bash
   pnpm changeset
   ```
   - Select which packages changed
   - Choose version bump type (patch/minor/major)
   - Write a summary of changes

2. **Commit and push:**
   ```bash
   git add .changeset
   git commit -m "chore: add changeset"
   git push
   ```

3. **Version and publish:**
   - The GitHub Action will automatically:
     - Create a PR with version bumps
     - Merge the PR
     - Publish to npm

### Manual Publishing

If you need to publish manually:

```bash
# Version packages
pnpm changeset version

# Publish (use appropriate tag)
pnpm changeset publish --tag alpha
```

## Troubleshooting

### "You do not have permission to publish"

- Ensure you're a member of the `@betagors` organization
- Check that your npm account has publish permissions
- Verify the organization name matches exactly: `betagors`

### "Package name already exists"

- Check if the package name is already taken on npm
- You may need to use a different name or contact npm support

### "Invalid token"

- Verify the token is an "Automation" token (not "Read-only" or "Publish")
- Check that the token hasn't expired
- Ensure the token is correctly set in GitHub Secrets as `NPM_TOKEN`

## Next Steps

Once publishing is set up:

1. Create your first changeset: `pnpm changeset`
2. Push to trigger the workflow
3. Monitor the GitHub Actions tab for publishing status

For more information, see:
- [Changesets Documentation](https://github.com/changesets/changesets)
- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)

