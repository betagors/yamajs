# @yamajs/ci

CI/CD plugin for Yama applications. Automatically generates GitHub Actions workflow files for testing, building, and deploying your application.

## Features

- ðŸ§ª **Test Workflow** - Automatically runs tests on PR/push
- ðŸ—ï¸ **Build Workflow** - Builds your application for production
- ðŸš€ **Deploy Workflow** - Deploys to Docker, Vercel, AWS, GCP, or Azure
- ðŸ“¦ **Package Manager Detection** - Supports pnpm, npm, and yarn
- ðŸ” **Test Framework Detection** - Auto-detects vitest, jest, mocha
- âš™ï¸ **Configurable** - Matrix builds, Node versions, deployment targets

## Installation

```bash
pnpm add @yamajs/ci
# or
npm install @yamajs/ci
# or
yarn add @yamajs/ci
```

## Configuration

Add to your `yama.yaml`:

```yaml
plugins:
  "@yamajs/ci":
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
import { getPluginAPI } from "@yamajs/core";

const ci = getPluginAPI("@yamajs/ci");

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
const ci = getPluginAPI("@yamajs/ci");
ci.writeAll();
```

### Custom Configuration

```typescript
const ci = getPluginAPI("@yamajs/ci");
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
const ci = getPluginAPI("@yamajs/ci");
const workflows = ci.generateAllWorkflows();
// Use the generated content as needed
```

## License

MPL-2.0
