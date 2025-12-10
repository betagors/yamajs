# @betagors/yama-docker

Docker and Docker Compose plugin for Yama applications. Automatically generates Dockerfiles and docker-compose.yml files based on your project configuration.

## Features

- 🐳 **Automatic Dockerfile generation** - Multi-stage builds optimized for production
- 🐙 **Docker Compose support** - Auto-detects and includes database/Redis services
- 📦 **Package manager detection** - Supports pnpm, npm, and yarn
- 🔍 **Plugin detection** - Automatically detects database and Redis plugins from yama.yaml
- 🏥 **Health checks** - Built-in health check support
- 🔒 **Security** - Non-root user by default
- ⚙️ **Configurable** - Extensive configuration options

## Installation

```bash
pnpm add @betagors/yama-docker
# or
npm install @betagors/yama-docker
# or
yarn add @betagors/yama-docker
```

## Configuration

Add to your `yama.yaml`:

```yaml
plugins:
  "@betagors/yama-docker":
    nodeVersion: "20"
    baseImage: "alpine"
    port: 4000
    healthCheck: true
    healthCheckPath: "/health"
    nonRootUser: true
    outputDir: "dist"
    envVars:
      - NODE_ENV=production
    compose:
      includeDatabase: true
      databaseType: "postgres"
      databaseVersion: "16-alpine"
      includeRedis: true
      redisVersion: "7-alpine"
```

## Usage

### Programmatic API

```typescript
import { getPluginAPI } from "@betagors/yama-core";

const docker = getPluginAPI("@betagors/yama-docker");

// Generate files
const dockerfile = docker.generateDockerfile();
const compose = docker.generateDockerCompose();
const dockerignore = docker.generateDockerIgnore();

// Write files to project
docker.writeAll(); // Write all files
docker.writeDockerfile(); // Write only Dockerfile
docker.writeDockerCompose(); // Write only docker-compose.yml
docker.writeDockerIgnore(); // Write only .dockerignore

// Overwrite existing files
docker.writeAll(true);

// Update configuration
docker.updateConfig({
  port: 3000,
  healthCheck: false,
});
```

### Configuration Options

#### DockerPluginConfig

- `nodeVersion?: string` - Node.js version (default: "20")
- `baseImage?: "alpine" | "slim" | "full"` - Base image variant (default: "alpine")
- `port?: number` - Application port (default: 4000)
- `packageManager?: "pnpm" | "npm" | "yarn"` - Package manager (auto-detected)
- `healthCheck?: boolean` - Enable health checks (default: true)
- `healthCheckPath?: string` - Health check endpoint (default: "/health")
- `nonRootUser?: boolean` - Run as non-root user (default: true)
- `buildCommand?: string` - Build command (auto-detected from package.json)
- `startCommand?: string` - Start command (auto-detected from package.json)
- `outputDir?: string` - Output directory (default: "dist")
- `envVars?: string[]` - Environment variables to include
- `additionalInstructions?: string[]` - Additional Dockerfile instructions
- `compose?: DockerComposeConfig` - Docker Compose configuration

#### DockerComposeConfig

- `includeDatabase?: boolean` - Include database service (auto-detected from plugins)
- `databaseType?: "postgres" | "mysql" | "mariadb" | "mongodb"` - Database type
- `databaseVersion?: string` - Database version
- `databaseEnv?: Record<string, string>` - Database environment variables
- `includeRedis?: boolean` - Include Redis service (auto-detected from plugins)
- `redisVersion?: string` - Redis version
- `additionalServices?: Record<string, DockerComposeService>` - Additional services
- `volumes?: Record<string, unknown>` - Volumes configuration
- `networks?: Record<string, unknown>` - Networks configuration

## Auto-Detection

The plugin automatically detects:

- **Package manager** from lock files (pnpm-lock.yaml, yarn.lock, package-lock.json)
- **Node version** from .nvmrc or package.json engines
- **Build/start commands** from package.json scripts
- **Database plugin** from yama.yaml plugins (postgres, pglite, etc.)
- **Redis plugin** from yama.yaml plugins

## Generated Files

### Dockerfile

- Multi-stage build (builder + runner)
- Optimized for production
- Non-root user by default
- Health checks included
- Supports all package managers

### docker-compose.yml

- App service with build configuration
- Database service (if database plugin detected)
- Redis service (if Redis plugin detected)
- Health checks for all services
- Proper service dependencies

### .dockerignore

- Excludes node_modules, build outputs, test files
- Excludes IDE and OS files
- Excludes documentation and CI/CD files

## Examples

### Basic Usage

```typescript
const docker = getPluginAPI("@betagors/yama-docker");
docker.writeAll();
```

### Custom Configuration

```typescript
const docker = getPluginAPI("@betagors/yama-docker");
docker.updateConfig({
  nodeVersion: "18",
  port: 3000,
  compose: {
    databaseType: "postgres",
    databaseVersion: "15-alpine",
    databaseEnv: {
      POSTGRES_USER: "myuser",
      POSTGRES_PASSWORD: "mypassword",
      POSTGRES_DB: "mydb",
    },
  },
});
docker.writeAll(true);
```

### Generate Without Writing

```typescript
const docker = getPluginAPI("@betagors/yama-docker");
const dockerfile = docker.generateDockerfile();
const compose = docker.generateDockerCompose();
// Use the generated content as needed
```

## License

MPL-2.0




