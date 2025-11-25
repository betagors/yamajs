# Publishing Issue Investigation Summary

## Problem
Getting `E404 Not Found` errors when trying to publish scoped packages `@betagors/*` to npm.

## Root Cause Analysis

The `E404 Not Found` error when publishing scoped packages typically indicates one of these issues:

1. **Organization doesn't exist** - The `@betagors` organization hasn't been created on npm
2. **Token created from wrong account** - Token was created from personal account instead of organization
3. **Token lacks permissions** - Token doesn't have publish permissions for the organization scope
4. **Token type issue** - Using deprecated Classic token instead of required Granular Access Token (as of Nov 2025)

## Configuration Check Results

### ✅ Package Configuration (All Correct)
- All 9 packages have `"publishConfig": { "access": "public" }` ✓
- All packages use correct scope: `@betagors/*` ✓
- All packages have proper repository metadata ✓

### ✅ Changeset Configuration (Correct)
- Changeset config has `"access": "public"` ✓
- Base branch set to `main` ✓

### ⚠️ Workflow Configuration (Improved)
**Before:**
- Manual npmrc configuration
- No authentication verification
- No scope configuration in setup-node

**After (Fixed):**
- Using `setup-node` with `scope` and `always-auth` parameters
- Added authentication verification step
- Better error messages and diagnostics

## Key Changes Made

### 1. Improved Workflow Configuration
```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: 20
    registry-url: 'https://registry.npmjs.org'
    scope: '@betagors'
    always-auth: true
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 2. Added Authentication Verification
```yaml
- name: Verify npm authentication
  run: |
    echo "Verifying npm authentication..."
    npm whoami --registry=https://registry.npmjs.org/ || echo "⚠️ npm whoami failed - check token"
    echo "Checking organization access..."
    npm access ls-packages @betagors || echo "⚠️ Cannot access @betagors organization - verify org exists and token has permissions"
```

## Action Items for User

### Step 1: Verify Organization Exists
1. Visit https://www.npmjs.com/org/betagors
2. If you see "404" or "Not Found", create the organization:
   - Go to https://www.npmjs.com/org/create
   - Enter organization name: `betagors`
   - Complete setup

### Step 2: Create Granular Access Token
**CRITICAL:** Token MUST be created from organization page, not personal account.

1. Go to https://www.npmjs.com/settings/betagors/tokens
2. Click "Generate New Token"
3. Select "Granular Access Token"
4. Configure:
   - **Name:** "GitHub Actions publishing"
   - **Expiration:** "Never expires" (or custom)
   - **Permissions:** "Read and write" for `@betagors` scope
   - **Packages:** `@betagors/*` or all packages
   - **Bypass 2FA:** ✅ Enable (required for automated workflows)
5. Copy the token immediately

### Step 3: Update GitHub Secret
1. Go to GitHub repository → Settings → Secrets and variables → Actions
2. Update or create `NPM_TOKEN` secret with the new token

### Step 4: Test the Workflow
1. Push changes to `main` branch or manually trigger workflow
2. Check the "Verify npm authentication" step in workflow logs
3. If verification fails, check the error messages:
   - `npm whoami failed` → Token is invalid or expired
   - `Cannot access @betagors organization` → Organization doesn't exist or token lacks permissions

## Common Mistakes

1. **Creating token from personal account** → Must create from org page
2. **Using Classic token** → Must use Granular Access Token (Classic deprecated Nov 2025)
3. **Token without publish permissions** → Must have "Read and write" or "Publish packages"
4. **Not enabling Bypass 2FA** → Required for automated workflows if org has 2FA

## Verification Commands (Local Testing)

```bash
# Set token
export NPM_TOKEN="your-token-here"

# Configure npmrc
echo "@betagors:registry=https://registry.npmjs.org/" > ~/.npmrc
echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" >> ~/.npmrc

# Test authentication
npm whoami --registry=https://registry.npmjs.org/

# Test organization access
npm access ls-packages @betagors

# If both succeed, token is correct
```

## Next Steps

1. ✅ Workflow configuration improved
2. ⏳ User needs to verify/create npm organization
3. ⏳ User needs to create Granular Access Token from org page
4. ⏳ User needs to update GitHub secret
5. ⏳ Test workflow and check verification step

## References

- [npm Organization Setup](https://docs.npmjs.com/creating-and-publishing-an-organization-scoped-package)
- [Granular Access Tokens](https://docs.npmjs.com/creating-and-viewing-access-tokens)
- [GitHub Actions setup-node](https://github.com/actions/setup-node)


