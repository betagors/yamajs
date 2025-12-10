/**
 * CI plugin configuration
 */
export interface CIPluginConfig {
  /**
   * Node.js versions to test against (default: ["20", "22"])
   */
  nodeVersions?: string[];

  /**
   * Package manager to use (default: auto-detect)
   */
  packageManager?: "pnpm" | "npm" | "yarn";

  /**
   * Test framework (default: auto-detect)
   */
  testFramework?: "vitest" | "jest" | "mocha" | "none";

  /**
   * Enable test workflow (default: true)
   */
  enableTest?: boolean;

  /**
   * Enable build workflow (default: true)
   */
  enableBuild?: boolean;

  /**
   * Enable deploy workflow (default: false)
   */
  enableDeploy?: boolean;

  /**
   * Deployment target (default: "docker")
   */
  deployTarget?: "docker" | "vercel" | "aws" | "gcp" | "azure";

  /**
   * Build command (default: auto-detect)
   */
  buildCommand?: string;

  /**
   * Test command (default: auto-detect)
   */
  testCommand?: string;

  /**
   * Matrix strategy configuration
   */
  matrix?: {
    node?: string[];
    os?: string[];
  };

  /**
   * Additional environment variables
   */
  env?: Record<string, string>;

  /**
   * Workflow triggers
   */
  triggers?: {
    push?: {
      branches?: string[];
      paths?: string[];
    };
    pullRequest?: {
      branches?: string[];
      paths?: string[];
    };
    schedule?: string[];
    workflowDispatch?: boolean;
  };
}

/**
 * Project information for CI generation
 */
export interface CIProjectInfo {
  /**
   * Project name
   */
  name: string;

  /**
   * Project directory
   */
  projectDir: string;

  /**
   * Package manager detected
   */
  packageManager: "pnpm" | "npm" | "yarn";

  /**
   * Test framework detected
   */
  testFramework?: "vitest" | "jest" | "mocha" | "none";

  /**
   * Build script from package.json
   */
  buildScript?: string;

  /**
   * Test script from package.json
   */
  testScript?: string;

  /**
   * Has TypeScript
   */
  hasTypeScript?: boolean;
}
