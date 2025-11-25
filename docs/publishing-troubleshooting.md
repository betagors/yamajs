# Publishing Troubleshooting Guide

## How Changesets Publishing Works

The changesets action has a **two-step process**:

1. **Step 1: Create Version PR**
   - When you push changesets (`.changeset/*.md` files) to `main`
   - The action creates a PR that bumps version numbers in `package.json` files
   - This PR must be **merged** before publishing happens

2. **Step 2: Publish to npm**
   - After the version PR is merged, the next workflow run will publish packages
   - Publishing only happens when there are versioned changes (from merged PR)

## Common Issues

### Issue 1: No Changesets Exist

**Symptom**: Workflow runs but does nothing

**Solution**: Create a changeset first:
```bash
pnpm changeset
# Select packages that changed
# Choose version bump (patch/minor/major)
# Write a summary
git add .changeset
git commit -m "chore: add changeset"
git push
```

### Issue 2: Workflow Only Runs on `main` Branch

**Symptom**: Workflow doesn't trigger when pushing to `develop`

**Current Configuration**: The workflow is set to trigger on `main` branch only.

**Solutions**:
- **Option A**: Merge `develop` → `main` to trigger the workflow
- **Option B**: Update workflow to also trigger on `develop` (see below)

### Issue 3: Version PR Exists But Not Merged

**Symptom**: A "chore: version packages" PR exists but packages aren't published

**Solution**: Merge the version PR. Publishing only happens **after** the version PR is merged.

### Issue 4: Token Issues

**Symptoms**:
- "401 Unauthorized"
- "403 Forbidden"
- "404 Not Found" when publishing

**Checklist**:
- [ ] Token is set in GitHub Secrets as `NPM_TOKEN`
- [ ] Token has "Publish packages" or "Read and write" permission for `@betagors` scope
- [ ] Token was created from organization page: https://www.npmjs.com/settings/betagors/tokens
- [ ] Organization `betagors` exists on npm
- [ ] You're a member of the `@betagors` organization

### Issue 5: Workflow Runs But Doesn't Publish

**Possible Causes**:
1. No changesets exist → Create one first
2. Version PR not merged → Merge the version PR
3. Token not set → Add `NPM_TOKEN` to GitHub Secrets
4. Wrong branch → Workflow only runs on `main`

## Step-by-Step Publishing Process

### First Time Publishing

1. **Create a changeset**:
   ```bash
   pnpm changeset
   ```
   - Select packages: `@betagors/yama-cli`, `@betagors/yama-core`, etc.
   - Choose version: `patch` for first release
   - Write summary: "Initial alpha release"

2. **Commit and push to main**:
   ```bash
   git add .changeset
   git commit -m "chore: add changeset for initial release"
   git push origin main
   ```

3. **Wait for version PR**:
   - GitHub Actions will create a PR titled "chore: version packages"
   - Review the version bumps
   - **Merge the PR**

4. **Publishing happens automatically**:
   - After merging the version PR, the next workflow run will publish
   - Check GitHub Actions logs for publishing status
   - Verify packages on npm: https://www.npmjs.com/org/betagors

### Subsequent Publishing

1. Make code changes
2. Create changeset: `pnpm changeset`
3. Push to `main`
4. Merge version PR
5. Packages publish automatically

## Testing Publishing Locally

Before relying on CI/CD, test locally:

```bash
# 1. Build packages
pnpm build:packages

# 2. Version packages (simulates what the PR does)
pnpm changeset version

# 3. Test publish (dry run)
cd packages/core
npm publish --dry-run --access public --tag alpha

# 4. If dry run works, actually publish
npm publish --access public --tag alpha
```

## Debugging Workflow

### Check Workflow Logs

1. Go to GitHub → Actions tab
2. Click on the latest workflow run
3. Check the "Create Release Pull Request or Publish" step
4. Look for error messages

### Common Error Messages

- **"No changesets found"**: Create a changeset first
- **"401 Unauthorized"**: Token issue - check NPM_TOKEN secret
- **"403 Forbidden"**: Token doesn't have publish permissions
- **"404 Not Found"**: Organization doesn't exist or wrong scope
- **"Package name already exists"**: Package already published (this is normal for updates)

### Manual Workflow Trigger

You can manually trigger the workflow:
1. Go to GitHub → Actions → "Publish to npm"
2. Click "Run workflow"
3. Select tag: `alpha`, `beta`, or `latest`
4. Click "Run workflow"

## Quick Fix Checklist

If publishing isn't working, check:

- [ ] `NPM_TOKEN` exists in GitHub Secrets
- [ ] Token has publish permissions for `@betagors` scope
- [ ] At least one changeset exists (`.changeset/*.md` file)
- [ ] Changes are pushed to `main` branch (or workflow updated for your branch)
- [ ] Version PR (if exists) has been merged
- [ ] Packages have `"publishConfig": { "access": "public" }` in package.json
- [ ] Organization `betagors` exists on npm

## Still Not Working?

1. Check GitHub Actions logs for specific error messages
2. Verify token permissions on npm
3. Test publishing locally first
4. Ensure you're pushing to the correct branch (`main`)


