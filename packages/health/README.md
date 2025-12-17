# @yamajs/health

Yama health check plugin with comprehensive health monitoring and aggregation.

## Features

- **Automatic Plugin Health Checks**: Automatically collects health status from all loaded plugins
- **Custom Health Checks**: Register custom health checks for your application components
- **System Information**: Optional system metrics (memory, CPU, platform)
- **Component Filtering**: Exclude specific components or mark critical components
- **Detailed Reporting**: Get comprehensive health status with response times and details

## Installation

```bash
npm install @yamajs/health
# or
pnpm add @yamajs/health
# or
yarn add @yamajs/health
```

## Configuration

Add the health plugin to your `yama.yaml`:

```yaml
plugins:
  - name: "@yamajs/health"
    config:
      path: "/health"  # Health endpoint path (default: "/health")
      includeSystemInfo: true  # Include system metrics (default: true)
      includeDetails: true  # Include detailed component info (default: true)
      criticalComponents:  # Components that must be healthy
        - "@yamajs/postgres"
      excludeComponents:  # Components to exclude from checks
        - "@yamajs/logging"
      customChecks: []  # Custom health checks (see below)
```

## Usage

### Basic Usage

The health plugin automatically registers a health service that can be accessed via the plugin API:

```typescript
import { getPluginAPI } from "@yamajs/core";

// Get health status
const healthAPI = getPluginAPI("@yamajs/health");
const status = await healthAPI.getHealth();

console.log(status.healthy); // true/false
console.log(status.components); // Array of component health statuses
console.log(status.summary); // Summary statistics
```

### Register Custom Health Checks

```typescript
const healthAPI = getPluginAPI("@yamajs/health");

// Register a custom health check
healthAPI.registerCheck("database", async () => {
  try {
    // Check database connection
    await db.ping();
    return {
      name: "database",
      healthy: true,
      details: { connection: "ok" },
    };
  } catch (error) {
    return {
      name: "database",
      healthy: false,
      error: error.message,
    };
  }
});

// Unregister a check
healthAPI.unregisterCheck("database");
```

### Check Specific Component

```typescript
const healthAPI = getPluginAPI("@yamajs/health");
const componentHealth = await healthAPI.getComponentHealth("@yamajs/postgres");

if (componentHealth) {
  console.log(componentHealth.healthy);
  console.log(componentHealth.details);
}
```

### Quick Health Check

```typescript
const healthAPI = getPluginAPI("@yamajs/health");
const isHealthy = await healthAPI.isHealthy(); // true/false
```

## Health Status Format

```typescript
interface HealthStatus {
  healthy: boolean;           // Overall health status
  status: number;             // HTTP status code (200 or 503)
  timestamp: string;         // ISO timestamp
  uptime: number;            // Uptime in seconds
  system?: {                  // System information (if enabled)
    nodeVersion: string;
    platform: string;
    memory?: {
      used: number;
      total: number;
      percentage: number;
    };
  };
  components: ComponentHealth[];  // Individual component statuses
  summary: {
    total: number;            // Total components checked
    healthy: number;         // Number of healthy components
    unhealthy: number;       // Number of unhealthy components
  };
}
```

## Component Health Format

```typescript
interface ComponentHealth {
  name: string;              // Component name
  healthy: boolean;          // Health status
  error?: string;           // Error message if unhealthy
  details?: Record<string, unknown>;  // Additional details
  timestamp?: string;        // Check timestamp
  responseTime?: number;     // Response time in milliseconds
}
```

## HTTP Endpoint

The health plugin provides a health service that can be used to create HTTP endpoints. You can register a route in your `yama.yaml`:

```yaml
endpoints:
  - path: /health
    method: GET
    handler: healthHandler
```

And create a handler:

```typescript
// src/handlers/healthHandler.ts
import { getPluginAPI } from "@yamajs/core";

export default async function healthHandler(context) {
  const healthAPI = getPluginAPI("@yamajs/health");
  const status = await healthAPI.getHealth();
  
  return context
    .status(status.status)
    .send(status);
}
```

## Plugin Health Checks

Plugins can implement the `onHealthCheck` lifecycle hook to provide their own health status:

```typescript
const plugin: YamaPlugin = {
  name: "@yamajs/my-plugin",
  // ... other plugin config
  
  async onHealthCheck() {
    try {
      // Perform health check
      await checkSomething();
      return {
        healthy: true,
        details: { /* ... */ },
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  },
};
```

## License

MPL-2.0



















