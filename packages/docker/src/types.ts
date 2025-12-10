/**
 * Docker plugin configuration
 */
export interface DockerPluginConfig {
  /**
   * Node.js version to use (default: "20")
   */
  nodeVersion?: string;

  /**
   * Base image variant (default: "alpine")
   */
  baseImage?: "alpine" | "slim" | "full";

  /**
   * Application port (default: 4000)
   */
  port?: number;

  /**
   * Package manager to use (default: auto-detect)
   */
  packageManager?: "pnpm" | "npm" | "yarn";

  /**
   * Enable health checks (default: true)
   */
  healthCheck?: boolean;

  /**
   * Health check endpoint (default: "/health")
   */
  healthCheckPath?: string;

  /**
   * Run as non-root user (default: true)
   */
  nonRootUser?: boolean;

  /**
   * Build command (default: auto-detect)
   */
  buildCommand?: string;

  /**
   * Start command (default: auto-detect)
   */
  startCommand?: string;

  /**
   * Output directory for built files (default: "dist")
   */
  outputDir?: string;

  /**
   * Environment variables to include in Dockerfile
   */
  envVars?: string[];

  /**
   * Additional Dockerfile instructions
   */
  additionalInstructions?: string[];

  /**
   * Docker Compose configuration
   */
  compose?: DockerComposeConfig;
}

/**
 * Docker Compose configuration
 */
export interface DockerComposeConfig {
  /**
   * Include database service (default: auto-detect from plugins)
   */
  includeDatabase?: boolean;

  /**
   * Database type (default: auto-detect)
   */
  databaseType?: "postgres" | "mysql" | "mariadb" | "mongodb";

  /**
   * Database version (default: latest)
   */
  databaseVersion?: string;

  /**
   * Database environment variables
   */
  databaseEnv?: Record<string, string>;

  /**
   * Include Redis service (default: auto-detect from plugins)
   */
  includeRedis?: boolean;

  /**
   * Redis version (default: latest)
   */
  redisVersion?: string;

  /**
   * Include Mailpit for email testing (default: false)
   */
  includeMailpit?: boolean;

  /**
   * Mailpit version (default: latest)
   */
  mailpitVersion?: string;

  /**
   * Include pgAdmin for PostgreSQL management (default: false)
   */
  includePgAdmin?: boolean;

  /**
   * pgAdmin version (default: latest)
   */
  pgAdminVersion?: string;

  /**
   * Include Adminer for database management (default: false)
   */
  includeAdminer?: boolean;

  /**
   * Adminer version (default: latest)
   */
  adminerVersion?: string;

  /**
   * Additional services
   */
  additionalServices?: Record<string, DockerComposeService>;

  /**
   * Volumes configuration
   */
  volumes?: Record<string, unknown>;

  /**
   * Networks configuration
   */
  networks?: Record<string, unknown>;
}

/**
 * Docker Compose service definition
 */
export interface DockerComposeService {
  image?: string;
  build?: {
    context?: string;
    dockerfile?: string;
  };
  ports?: string[];
  environment?: string[] | Record<string, string>;
  env_file?: string[];
  volumes?: string[];
  depends_on?: string[];
  networks?: string[];
  healthcheck?: {
    test: string | string[];
    interval?: string;
    timeout?: string;
    retries?: number;
    start_period?: string;
  };
  [key: string]: unknown;
}

/**
 * Project information for Docker generation
 */
export interface ProjectInfo {
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
   * Node version from package.json or .nvmrc
   */
  nodeVersion?: string;

  /**
   * Build script from package.json
   */
  buildScript?: string;

  /**
   * Start script from package.json
   */
  startScript?: string;

  /**
   * Configured plugins
   */
  plugins?: string[];

  /**
   * Database plugin detected
   */
  databasePlugin?: string;

  /**
   * Redis plugin detected
   */
  redisPlugin?: boolean;

  /**
   * Port from config or default
   */
  port: number;
}




