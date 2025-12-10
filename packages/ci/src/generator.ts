import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CIPluginConfig, CIProjectInfo } from "./types.js";

/**
 * Detect package manager from lock files
 */
export function detectPackageManager(projectDir: string): "pnpm" | "npm" | "yarn" {
  if (existsSync(join(projectDir, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (existsSync(join(projectDir, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

/**
 * Detect test framework from package.json
 */
export function detectTestFramework(projectDir: string): "vitest" | "jest" | "mocha" | "none" {
  const packageJsonPath = join(projectDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return "none";
  }

  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    const deps = {
      ...((packageJson.dependencies || {}) as Record<string, string>),
      ...((packageJson.devDependencies || {}) as Record<string, string>),
    };

    if (deps.vitest || deps["@vitest/coverage-v8"]) {
      return "vitest";
    }
    if (deps.jest || deps["@types/jest"]) {
      return "jest";
    }
    if (deps.mocha || deps["@types/mocha"]) {
      return "mocha";
    }

    // Check test script
    const testScript = packageJson.scripts?.test || "";
    if (testScript.includes("vitest")) {
      return "vitest";
    }
    if (testScript.includes("jest")) {
      return "jest";
    }
    if (testScript.includes("mocha")) {
      return "mocha";
    }

    return "none";
  } catch {
    return "none";
  }
}

/**
 * Get project information
 */
export function getCIProjectInfo(
  projectDir: string,
  config: CIPluginConfig
): CIProjectInfo {
  const packageJsonPath = join(projectDir, "package.json");
  let packageJson: any = {};
  
  if (existsSync(packageJsonPath)) {
    try {
      packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    } catch {
      // Ignore parse errors
    }
  }

  const packageManager = config.packageManager || detectPackageManager(projectDir);
  const testFramework = config.testFramework || detectTestFramework(projectDir);
  const scripts = packageJson.scripts || {};
  const buildScript = config.buildCommand || scripts.build;
  const testScript = config.testCommand || scripts.test;
  const hasTypeScript = existsSync(join(projectDir, "tsconfig.json"));

  return {
    name: packageJson.name || "yama-app",
    projectDir,
    packageManager,
    testFramework,
    buildScript,
    testScript,
    hasTypeScript,
  };
}

/**
 * Generate test workflow
 */
export function generateTestWorkflow(
  projectInfo: CIProjectInfo,
  config: CIPluginConfig
): string {
  const nodeVersions = config.nodeVersions || ["20", "22"];
  const packageManager = projectInfo.packageManager;
  const testFramework = projectInfo.testFramework || "none";
  const triggers = config.triggers || {};

  let workflow = `name: Test

on:
  push:
    branches: ${triggers.push?.branches ? JSON.stringify(triggers.push.branches) : '["main", "develop"]'}
${triggers.push?.paths ? `    paths: ${JSON.stringify(triggers.push.paths)}\n` : ""}  pull_request:
    branches: ${triggers.pullRequest?.branches ? JSON.stringify(triggers.pullRequest.branches) : '["main", "develop"]'}
${triggers.pullRequest?.paths ? `    paths: ${JSON.stringify(triggers.pullRequest.paths)}\n` : ""}${triggers.workflowDispatch ? `  workflow_dispatch:\n` : ""}
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ${JSON.stringify(nodeVersions)}
`;

  if (config.matrix?.os) {
    workflow += `        os: ${JSON.stringify(config.matrix.os)}\n`;
  }

  workflow += `
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
`;

  if (packageManager === "pnpm") {
    workflow += `
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Get pnpm store directory
        shell: bash
        run: |
          echo "STORE_PATH=\$(pnpm store path --silent)" >> $GITHUB_ENV
      
      - name: Setup pnpm cache
        uses: actions/cache@v3
        with:
          path: \${{ env.STORE_PATH }}
          key: \${{ runner.os }}-pnpm-store-\${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: |
            \${{ runner.os }}-pnpm-store-
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
`;
  } else if (packageManager === "yarn") {
    workflow += `
      - name: Enable Corepack
        run: corepack enable
      
      - name: Get yarn cache directory
        shell: bash
        run: |
          echo "YARN_CACHE_DIR=\$(yarn cache dir)" >> $GITHUB_ENV
      
      - name: Setup yarn cache
        uses: actions/cache@v3
        with:
          path: \${{ env.YARN_CACHE_DIR }}
          key: \${{ runner.os }}-yarn-\${{ hashFiles('**/yarn.lock') }}
          restore-keys: |
            \${{ runner.os }}-yarn-
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
`;
  } else {
    workflow += `
      - name: Setup npm cache
        uses: actions/cache@v3
        with:
          path: ~/.npm
          key: \${{ runner.os }}-node-\${{ hashFiles('**/package-lock.json') }}
          restore-keys: |
            \${{ runner.os }}-node-
      
      - name: Install dependencies
        run: npm ci
`;
  }

  if (projectInfo.hasTypeScript) {
    workflow += `
      - name: Type check
        run: ${packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : "npm"} run type-check || true
`;
  }

  if (testFramework !== "none" && projectInfo.testScript) {
    workflow += `
      - name: Run tests
        run: ${packageManager === "pnpm" ? "pnpm" : packageManager === "yarn" ? "yarn" : "npm"} test
`;

    if (testFramework === "vitest" || testFramework === "jest") {
      workflow += `
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          token: \${{ secrets.CODECOV_TOKEN }}
          fail_ci_if_error: false
`;
    }
  } else {
    workflow += `
      - name: No tests configured
        run: echo "No test framework detected"
`;
  }

  // Add environment variables
  if (config.env && Object.keys(config.env).length > 0) {
    workflow += `
    env:`;
    for (const [key, value] of Object.entries(config.env)) {
      workflow += `
      ${key}: ${value}`;
    }
  }

  workflow += "\n";

  return workflow;
}

/**
 * Generate build workflow
 */
export function generateBuildWorkflow(
  projectInfo: CIProjectInfo,
  config: CIPluginConfig
): string {
  const nodeVersions = config.nodeVersions || ["20"];
  const packageManager = projectInfo.packageManager;
  const triggers = config.triggers || {};

  let workflow = `name: Build

on:
  push:
    branches: ${triggers.push?.branches ? JSON.stringify(triggers.push.branches) : '["main"]'}
${triggers.push?.paths ? `    paths: ${JSON.stringify(triggers.push.paths)}\n` : ""}${triggers.workflowDispatch ? `  workflow_dispatch:\n` : ""}
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: ${JSON.stringify(nodeVersions)}
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
`;

  if (packageManager === "pnpm") {
    workflow += `
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build
        run: pnpm build
`;
  } else if (packageManager === "yarn") {
    workflow += `
      - name: Enable Corepack
        run: corepack enable
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Build
        run: yarn build
`;
  } else {
    workflow += `
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
`;
  }

  if (config.deployTarget === "docker") {
    workflow += `
      - name: Build Docker image
        run: docker build -t \${{ github.repository }}:\${{ github.sha }} .
`;
  }

  // Add environment variables
  if (config.env && Object.keys(config.env).length > 0) {
    workflow += `
    env:`;
    for (const [key, value] of Object.entries(config.env)) {
      workflow += `
      ${key}: ${value}`;
    }
  }

  workflow += "\n";

  return workflow;
}

/**
 * Generate deploy workflow
 */
export function generateDeployWorkflow(
  projectInfo: CIProjectInfo,
  config: CIPluginConfig
): string {
  const packageManager = projectInfo.packageManager;
  const deployTarget = config.deployTarget || "docker";
  const triggers = config.triggers || {};

  let workflow = `name: Deploy

on:
  push:
    branches: ${triggers.push?.branches ? JSON.stringify(triggers.push.branches) : '["main"]'}
${triggers.workflowDispatch ? `  workflow_dispatch:\n` : ""}
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
`;

  if (packageManager === "pnpm") {
    workflow += `
      - uses: pnpm/action-setup@v2
        with:
          version: 8
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
`;
  } else if (packageManager === "yarn") {
    workflow += `
      - name: Enable Corepack
        run: corepack enable
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
`;
  } else {
    workflow += `
      - name: Install dependencies
        run: npm ci
`;
  }

  if (deployTarget === "docker") {
    workflow += `
      - name: Build Docker image
        run: docker build -t \${{ github.repository }}:\${{ github.sha }} .
      
      - name: Deploy to Docker
        run: |
          echo "Deploy Docker image"
          # Add your deployment steps here
`;
  } else if (deployTarget === "vercel") {
    workflow += `
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: \${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: \${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: \${{ secrets.VERCEL_PROJECT_ID }}
`;
  }

  // Add environment variables
  if (config.env && Object.keys(config.env).length > 0) {
    workflow += `
    env:`;
    for (const [key, value] of Object.entries(config.env)) {
      workflow += `
      ${key}: ${value}`;
    }
  }

  workflow += "\n";

  return workflow;
}

/**
 * Ensure .github/workflows directory exists
 */
export function ensureWorkflowsDir(projectDir: string): void {
  const workflowsDir = join(projectDir, ".github", "workflows");
  if (!existsSync(workflowsDir)) {
    mkdirSync(workflowsDir, { recursive: true });
  }
}


