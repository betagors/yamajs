# @betagors/yama-ci

CI/CD plugin for Yama applications. Automatically generates GitHub Actions workflow files for testing, building, and deploying your application.

## Features

- 🧪 **Test Workflow** - Automatically runs tests on PR/push
- 🏗️ **Build Workflow** - Builds your application for production
- 🚀 **Deploy Workflow** - Deploys to Docker, Vercel, AWS, GCP, or Azure
- 📦 **Package Manager Detection** - Supports pnpm, npm, and yarn
- 🔍 **Test Framework Detection** - Auto-detects vitest, jest, mocha
- ⚙️ **Configurable** - Matrix builds, Node versions, deployment targets

## Installation

```bash
pnpm add @betagors/yama-ci
# or
npm install @betagors/yama-ci
# or
yarn add @betagors/yama-ci
```

## Configuration

Add to your `yama.yaml`:

```yaml
plugins:
  "@betagors/yama-ci":
    nodeVersions: ["20", "22"]
    enableTest: true
    enableBuild: true
    enableDeploy: false
    deployTarget: "docker"
    triggers:
      push:
        branches: ["main", "develop"]
      pullRequest:
        branches: ["main"]
      workflowDispatch: true
```

## Usage

### CLI Commands

```bash
# Generate workflow files (preview)
yama ci generate

# Write workflow files to .github/workflows
yama ci write

# Write with overwrite
yama ci write --overwrite

# Write specific workflows only
yama ci write --test-only
yama ci write --build-only
yama ci write --deploy-only
```

### Programmatic API

```typescript
import { getPluginAPI } from "@betagors/yama-core";

const ci = getPluginAPI("@betagors/yama-ci");

// Generate workflows
const workflows = ci.generateAllWorkflows();
const testWorkflow = ci.generateTestWorkflow();
const buildWorkflow = ci.generateBuildWorkflow();
const deployWorkflow = ci.generateDeployWorkflow();

// Write workflows
ci.writeAll(); // Write all workflows
ci.writeTestWorkflow(); // Write test workflow only
ci.writeBuildWorkflow(); // Write build workflow only
ci.writeDeployWorkflow(); // Write deploy workflow only

// Overwrite existing files
ci.writeAll(true);

// Update configuration
ci.updateConfig({
  nodeVersions: ["18", "20", "22"],
  enableDeploy: true,
  deployTarget: "vercel",
});
```

## Configuration Options

### CIPluginConfig

- `nodeVersions?: string[]` - Node.js versions to test against (default: `["20", "22"]`)
- `packageManager?: "pnpm" | "npm" | "yarn"` - Package manager (auto-detected)
- `testFramework?: "vitest" | "jest" | "mocha" | "none"` - Test framework (auto-detected)
- `enableTest?: boolean` - Enable test workflow (default: `true`)
- `enableBuild?: boolean` - Enable build workflow (default: `true`)
- `enableDeploy?: boolean` - Enable deploy workflow (default: `false`)
- `deployTarget?: "docker" | "vercel" | "aws" | "gcp" | "azure"` - Deployment target (default: `"docker"`)
- `buildCommand?: string` - Build command (auto-detected from package.json)
- `testCommand?: string` - Test command (auto-detected from package.json)
- `matrix?: { node?: string[]; os?: string[] }` - Matrix strategy configuration
- `env?: Record<string, string>` - Additional environment variables
- `triggers?: { push?: { branches?: string[]; paths?: string[] }; pullRequest?: { branches?: string[]; paths?: string[] }; schedule?: string[]; workflowDispatch?: boolean }` - Workflow triggers

## Auto-Detection

The plugin automatically detects:

- **Package manager** from lock files (pnpm-lock.yaml, yarn.lock, package-lock.json)
- **Test framework** from package.json dependencies and scripts
- **Build/test commands** from package.json scripts
- **TypeScript** from tsconfig.json presence

## Generated Workflows

### Test Workflow (`.github/workflows/test.yml`)

- Runs on push to main/develop and pull requests
- Tests against multiple Node.js versions
- Supports matrix builds
- Includes coverage upload for vitest/jest
- Caches dependencies for faster builds

### Build Workflow (`.github/workflows/build.yml`)

- Runs on push to main
- Builds application
- Optionally builds Docker image
- Supports matrix builds

### Deploy Workflow (`.github/workflows/deploy.yml`)

- Runs on push to main
- Deploys to configured target (Docker, Vercel, etc.)
- Configurable deployment steps

## Examples

### Basic Usage

```typescript
const ci = getPluginAPI("@betagors/yama-ci");
ci.writeAll();
```

### Custom Configuration

```typescript
const ci = getPluginAPI("@betagors/yama-ci");
ci.updateConfig({
  nodeVersions: ["18", "20", "22"],
  enableDeploy: true,
  deployTarget: "vercel",
  triggers: {
    push: {
      branches: ["main"],
      paths: ["src/**", "package.json"],
    },
    workflowDispatch: true,
  },
});
ci.writeAll(true);
```

### Generate Without Writing

```typescript
const ci = getPluginAPI("@betagors/yama-ci");
const workflows = ci.generateAllWorkflows();
// Use the generated content as needed
```

## License

MPL-2.0
