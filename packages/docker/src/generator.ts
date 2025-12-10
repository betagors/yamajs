import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import type {
  DockerPluginConfig,
  DockerComposeConfig,
  ProjectInfo,
} from "./types.js";

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
 * Detect Node version from package.json or .nvmrc
 */
export function detectNodeVersion(projectDir: string): string | undefined {
  // Check .nvmrc first
  const nvmrcPath = join(projectDir, ".nvmrc");
  if (existsSync(nvmrcPath)) {
    const version = readFileSync(nvmrcPath, "utf-8").trim();
    if (version) {
      return version;
    }
  }

  // Check package.json engines
  const packageJsonPath = join(projectDir, "package.json");
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
      if (packageJson.engines?.node) {
        const nodeVersion = packageJson.engines.node;
        // Extract version number (e.g., ">=18" -> "18", "^20.0.0" -> "20")
        const match = nodeVersion.match(/(\d+)/);
        if (match) {
          return match[1];
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return undefined;
}

/**
 * Detect plugins from yama.yaml
 */
function detectPlugins(projectDir: string): {
  plugins: string[];
  databasePlugin?: string;
  redisPlugin: boolean;
} {
  const yamaConfigPath = join(projectDir, "yama.yaml");
  const plugins: string[] = [];
  let databasePlugin: string | undefined;
  let redisPlugin = false;

  if (existsSync(yamaConfigPath)) {
    try {
      const yamlContent = readFileSync(yamaConfigPath, "utf-8");
      const yamaConfig = yaml.load(yamlContent) as {
        plugins?: Record<string, unknown> | string[];
      };

      if (yamaConfig.plugins) {
        if (Array.isArray(yamaConfig.plugins)) {
          plugins.push(...yamaConfig.plugins);
        } else {
          plugins.push(...Object.keys(yamaConfig.plugins));
        }

        // Detect database plugin
        databasePlugin = plugins.find((p) =>
          p.includes("postgres") || p.includes("pglite") || p.includes("database")
        );

        // Detect Redis plugin
        redisPlugin = plugins.some((p) => p.includes("redis"));
      }
    } catch {
      // Ignore parse errors
    }
  }

  return { plugins, databasePlugin, redisPlugin };
}

/**
 * Get project information
 */
export function getProjectInfo(
  projectDir: string,
  config: DockerPluginConfig
): ProjectInfo {
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
  const nodeVersion = config.nodeVersion || detectNodeVersion(projectDir) || "20";

  // Extract build and start commands
  const scripts = packageJson.scripts || {};
  const buildScript = config.buildCommand || scripts.build;
  const startScript = config.startCommand || scripts.start;

  // Detect plugins
  const { plugins, databasePlugin, redisPlugin } = detectPlugins(projectDir);

  return {
    name: packageJson.name || "yama-app",
    projectDir,
    packageManager,
    nodeVersion,
    buildScript,
    startScript,
    plugins,
    databasePlugin,
    redisPlugin,
    port: config.port || 4000,
  };
}

/**
 * Generate Dockerfile
 */
export function generateDockerfile(
  projectInfo: ProjectInfo,
  config: DockerPluginConfig
): string {
  const nodeVersion = projectInfo.nodeVersion || "20";
  const baseImage = config.baseImage || "alpine";
  const imageTag = `node:${nodeVersion}-${baseImage}`;
  const outputDir = config.outputDir || "dist";
  const port = projectInfo.port || 4000;
  const healthCheckPath = config.healthCheckPath || "/health";
  const nonRootUser = config.nonRootUser !== false;

  let dockerfile = `FROM ${imageTag} AS builder

WORKDIR /app

# Install package manager
`;

  // Install package manager
  if (projectInfo.packageManager === "pnpm") {
    dockerfile += `RUN corepack enable pnpm && corepack prepare pnpm --activate
`;
  } else if (projectInfo.packageManager === "yarn") {
    dockerfile += `RUN corepack enable yarn && corepack prepare yarn --activate
`;
  }

  // Copy package files
  dockerfile += `
# Copy package files
COPY package.json `;
  
  if (projectInfo.packageManager === "pnpm") {
    dockerfile += `pnpm-lock.yaml `;
  } else if (projectInfo.packageManager === "yarn") {
    dockerfile += `yarn.lock `;
  } else {
    dockerfile += `package-lock.json `;
  }
  
  dockerfile += `./

# Install dependencies
`;

  if (projectInfo.packageManager === "pnpm") {
    dockerfile += `RUN pnpm install --frozen-lockfile
`;
  } else if (projectInfo.packageManager === "yarn") {
    dockerfile += `RUN yarn install --frozen-lockfile
`;
  } else {
    dockerfile += `RUN npm ci
`;
  }

  // Copy source and build
  dockerfile += `
# Copy source and build
COPY . .
`;

  if (projectInfo.buildScript) {
    if (projectInfo.packageManager === "pnpm") {
      dockerfile += `RUN pnpm build
`;
    } else if (projectInfo.packageManager === "yarn") {
      dockerfile += `RUN yarn build
`;
    } else {
      dockerfile += `RUN npm run build
`;
    }
  }

  // Production image
  dockerfile += `
# Production image
FROM ${imageTag} AS runner

WORKDIR /app
`;

  // Add non-root user
  if (nonRootUser) {
    dockerfile += `
# Create non-root user
RUN addgroup -g 1001 -S nodejs && \\
    adduser -S yama -u 1001
`;
  }

  // Install package manager for production
  dockerfile += `
# Install package manager
`;

  if (projectInfo.packageManager === "pnpm") {
    dockerfile += `RUN corepack enable pnpm && corepack prepare pnpm --activate
`;
  } else if (projectInfo.packageManager === "yarn") {
    dockerfile += `RUN corepack enable yarn && corepack prepare yarn --activate
`;
  }

  // Copy package files
  dockerfile += `
# Copy package files
COPY package.json `;
  
  if (projectInfo.packageManager === "pnpm") {
    dockerfile += `pnpm-lock.yaml `;
  } else if (projectInfo.packageManager === "yarn") {
    dockerfile += `yarn.lock `;
  } else {
    dockerfile += `package-lock.json `;
  }
  
  dockerfile += `./

# Install production dependencies
`;

  if (projectInfo.packageManager === "pnpm") {
    dockerfile += `RUN pnpm install --prod --frozen-lockfile
`;
  } else if (projectInfo.packageManager === "yarn") {
    dockerfile += `RUN yarn install --prod --frozen-lockfile
`;
  } else {
    dockerfile += `RUN npm ci --only=production
`;
  }

  // Copy built application
  dockerfile += `
# Copy built application
COPY --from=builder /app/${outputDir} ./${outputDir}
COPY --from=builder /app/node_modules ./node_modules
`;

  // Copy additional files if needed
  if (existsSync(join(projectInfo.projectDir, "yama.yaml"))) {
    dockerfile += `COPY yama.yaml ./
`;
  }

  // Set user
  if (nonRootUser) {
    dockerfile += `
# Set user
USER yama
`;
  }

  // Expose port
  dockerfile += `
# Expose port
EXPOSE ${port}
`;

  // Add environment variables
  if (config.envVars && config.envVars.length > 0) {
    dockerfile += `
# Environment variables
`;
    for (const envVar of config.envVars) {
      dockerfile += `ENV ${envVar}
`;
    }
  }

  // Add additional instructions
  if (config.additionalInstructions && config.additionalInstructions.length > 0) {
    dockerfile += `
# Additional instructions
`;
    for (const instruction of config.additionalInstructions) {
      dockerfile += `${instruction}
`;
    }
  }

  // Add health check
  if (config.healthCheck !== false) {
    dockerfile += `
# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \\
  CMD node -e "require('http').get('http://localhost:${port}${healthCheckPath}', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
`;
  }

  // Start command
  dockerfile += `
# Start application
`;

  if (projectInfo.startScript) {
    if (projectInfo.packageManager === "pnpm") {
      dockerfile += `CMD ["pnpm", "start"]
`;
    } else if (projectInfo.packageManager === "yarn") {
      dockerfile += `CMD ["yarn", "start"]
`;
    } else {
      dockerfile += `CMD ["npm", "start"]
`;
    }
  } else {
    dockerfile += `CMD ["node", "${outputDir}/server.js"]
`;
  }

  return dockerfile;
}

/**
 * Generate docker-compose.yml
 */
export function generateDockerCompose(
  projectInfo: ProjectInfo,
  config: DockerPluginConfig
): string {
  const composeConfig = config.compose || {};
  const port = projectInfo.port || 4000;
  const healthCheckPath = config.healthCheckPath || "/health";

  let compose = `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "${port}:${port}"
    environment:
      - NODE_ENV=production
`;

  // Add environment variables from config
  if (config.envVars && config.envVars.length > 0) {
    for (const envVar of config.envVars) {
      const [key, value] = envVar.split("=");
      if (value) {
        compose += `      - ${key}=${value}
`;
      } else {
        compose += `      - ${key}=\${${key}}
`;
      }
    }
  }

  // Add health check
  if (config.healthCheck !== false) {
    compose += `    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:${port}${healthCheckPath}', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
`;
  }

  // Build depends_on list
  const dependsOn: string[] = [];
  const includeDatabase = composeConfig.includeDatabase !== false && (composeConfig.includeDatabase || projectInfo.databasePlugin);
  if (includeDatabase) {
    dependsOn.push("db:\n        condition: service_healthy");
  }
  if (composeConfig.includeMailpit) {
    dependsOn.push("mailpit");
  }

  // Add depends_on if we have any dependencies
  if (dependsOn.length > 0) {
    compose += `    depends_on:
`;
    for (const dep of dependsOn) {
      compose += `      ${dep}
`;
    }
  }

  // Add database service if configured
  if (includeDatabase) {
    const dbType = composeConfig.databaseType || "postgres";
    const dbVersion = composeConfig.databaseVersion || (dbType === "postgres" ? "16-alpine" : "latest");

    compose += `
  db:
    image: ${dbType}:${dbVersion}
    environment:
`;
    
    // Handle MongoDB separately
    if (dbType === "mongodb") {
      const dbEnv = composeConfig.databaseEnv || {
        MONGO_INITDB_ROOT_USERNAME: "admin",
        MONGO_INITDB_ROOT_PASSWORD: "password",
        MONGO_INITDB_DATABASE: "yama",
      };
      for (const [key, value] of Object.entries(dbEnv)) {
        compose += `      - ${key}=${value}
`;
      }
      compose += `    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
`;
    } else {
      if (dbType === "postgres") {
        const dbEnv = composeConfig.databaseEnv || {
          POSTGRES_USER: "postgres",
          POSTGRES_PASSWORD: "password",
          POSTGRES_DB: "yama",
        };
        for (const [key, value] of Object.entries(dbEnv)) {
          compose += `      - ${key}=${value}
`;
        }
        compose += `    volumes:
      - postgres_data:/var/lib/postgresql/data
`;
      } else if (dbType === "mysql" || dbType === "mariadb") {
        const dbEnv = composeConfig.databaseEnv || {
          MYSQL_ROOT_PASSWORD: "password",
          MYSQL_DATABASE: "yama",
          MYSQL_USER: "yama",
          MYSQL_PASSWORD: "password",
        };
        for (const [key, value] of Object.entries(dbEnv)) {
          compose += `      - ${key}=${value}
`;
        }
        compose += `    volumes:
      - mysql_data:/var/lib/mysql
`;
      }

      compose += `    healthcheck:
      test: ["CMD-SHELL", "${dbType === "postgres" ? "pg_isready -U postgres" : "mysqladmin ping -h localhost"}"]
      interval: 10s
      timeout: 5s
      retries: 5
`;
    }
  }

  // Add Redis service if configured
  const includeRedis = composeConfig.includeRedis !== false && (composeConfig.includeRedis || projectInfo.redisPlugin);
  if (includeRedis) {
    const redisVersion = composeConfig.redisVersion || "7-alpine";
    compose += `
  redis:
    image: redis:${redisVersion}
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
`;
  }

  // Add Mailpit service if configured
  if (composeConfig.includeMailpit) {
    const mailpitVersion = composeConfig.mailpitVersion || "latest";
    compose += `
  mailpit:
    image: axllent/mailpit:${mailpitVersion}
    ports:
      - "1025:1025"  # SMTP
      - "8025:8025"  # Web UI
    environment:
      - MP_SMTP_BIND_ADDR=0.0.0.0:1025
      - MP_WEB_BIND_ADDR=0.0.0.0:8025
`;
  }

  // Add pgAdmin service if configured
  if (composeConfig.includePgAdmin && includeDatabase && (composeConfig.databaseType === "postgres" || !composeConfig.databaseType)) {
    const pgAdminVersion = composeConfig.pgAdminVersion || "latest";
    compose += `
  pgadmin:
    image: dpage/pgadmin4:${pgAdminVersion}
    ports:
      - "5050:80"
    environment:
      - PGADMIN_DEFAULT_EMAIL=admin@example.com
      - PGADMIN_DEFAULT_PASSWORD=admin
      - PGADMIN_CONFIG_SERVER_MODE=False
    volumes:
      - pgadmin_data:/var/lib/pgadmin
    depends_on:
      - db
`;
  }

  // Add Adminer service if configured
  if (composeConfig.includeAdminer && includeDatabase) {
    const adminerVersion = composeConfig.adminerVersion || "latest";
    const dbType = composeConfig.databaseType || "postgres";
    compose += `
  adminer:
    image: adminer:${adminerVersion}
    ports:
      - "8080:8080"
    environment:
      - ADMINER_DEFAULT_SERVER=db
    depends_on:
      - db
`;
  }

  // Add additional services
  if (composeConfig.additionalServices) {
    for (const [name, service] of Object.entries(composeConfig.additionalServices)) {
      compose += `
  ${name}:
`;
      if (service.image) {
        compose += `    image: ${service.image}
`;
      }
      if (service.build) {
        compose += `    build:
`;
        if (service.build.context) {
          compose += `      context: ${service.build.context}
`;
        }
        if (service.build.dockerfile) {
          compose += `      dockerfile: ${service.build.dockerfile}
`;
        }
      }
      if (service.ports) {
        compose += `    ports:
`;
        for (const port of service.ports) {
          compose += `      - "${port}"
`;
        }
      }
      if (service.environment) {
        compose += `    environment:
`;
        if (Array.isArray(service.environment)) {
          for (const env of service.environment) {
            compose += `      - ${env}
`;
          }
        } else {
          for (const [key, value] of Object.entries(service.environment)) {
            compose += `      - ${key}=${value}
`;
          }
        }
      }
      if (service.volumes) {
        compose += `    volumes:
`;
        for (const volume of service.volumes) {
          compose += `      - ${volume}
`;
        }
      }
      if (service.depends_on) {
        compose += `    depends_on:
`;
        for (const dep of service.depends_on) {
          compose += `      - ${dep}
`;
        }
      }
    }
  }

  // Add volumes
  const volumes: string[] = [];
  if (includeDatabase) {
    const dbType = composeConfig.databaseType || "postgres";
    if (dbType === "postgres") {
      volumes.push("postgres_data");
    } else if (dbType === "mysql" || dbType === "mariadb") {
      volumes.push("mysql_data");
    } else if (dbType === "mongodb") {
      volumes.push("mongodb_data");
    }
  }
  if (includeRedis) {
    volumes.push("redis_data");
  }
  if (composeConfig.includePgAdmin) {
    volumes.push("pgadmin_data");
  }

  if (volumes.length > 0 || composeConfig.volumes) {
    compose += `
volumes:
`;
    for (const volume of volumes) {
      compose += `  ${volume}:
`;
    }
    if (composeConfig.volumes) {
      for (const [name, config] of Object.entries(composeConfig.volumes)) {
        compose += `  ${name}:
`;
        if (typeof config === "object" && config !== null) {
          for (const [key, value] of Object.entries(config)) {
            compose += `    ${key}: ${value}
`;
          }
        }
      }
    }
  }

  return compose;
}

/**
 * Generate .dockerignore file
 */
export function generateDockerIgnore(projectInfo: ProjectInfo): string {
  return `# Dependencies
node_modules
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Build outputs
dist
build
.yama
*.tsbuildinfo

# Environment files
.env
.env.local
.env.*.local

# IDE
.vscode
.idea
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Git
.git
.gitignore
.gitattributes

# Testing
coverage
.nyc_output
*.test.ts
*.test.js
*.spec.ts
*.spec.js

# Documentation
README.md
docs
*.md

# CI/CD
.github
.gitlab-ci.yml
.travis.yml
.circleci

# Docker
Dockerfile
docker-compose.yml
.dockerignore

# Misc
*.log
.cache
.temp
`;
}




