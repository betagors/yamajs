/**
 * Health check result for a single component
 */
export interface ComponentHealth {
  /**
   * Component name (e.g., plugin name, service name)
   */
  name: string;

  /**
   * Whether the component is healthy
   */
  healthy: boolean;

  /**
   * Optional error message if unhealthy
   */
  error?: string;

  /**
   * Optional details about the component's health
   */
  details?: Record<string, unknown>;

  /**
   * Timestamp of the health check
   */
  timestamp?: string;

  /**
   * Response time in milliseconds (if applicable)
   */
  responseTime?: number;
}

/**
 * Overall health status
 */
export interface HealthStatus {
  /**
   * Overall health status (true if all critical components are healthy)
   */
  healthy: boolean;

  /**
   * Status code (200 for healthy, 503 for unhealthy)
   */
  status: number;

  /**
   * Timestamp of the health check
   */
  timestamp: string;

  /**
   * Uptime in seconds
   */
  uptime: number;

  /**
   * System information
   */
  system?: {
    /**
     * Node.js version
     */
    nodeVersion: string;

    /**
     * Platform information
     */
    platform: string;

    /**
     * Memory usage
     */
    memory?: {
      used: number;
      total: number;
      percentage: number;
    };

    /**
     * CPU usage (if available)
     */
    cpu?: {
      usage: number;
    };
  };

  /**
   * Health status of individual components
   */
  components: ComponentHealth[];

  /**
   * Summary statistics
   */
  summary: {
    /**
     * Total number of components checked
     */
    total: number;

    /**
     * Number of healthy components
     */
    healthy: number;

    /**
     * Number of unhealthy components
     */
    unhealthy: number;
  };
}

/**
 * Health check configuration
 */
export interface HealthPluginConfig {
  /**
   * Path for the health endpoint (default: "/health")
   */
  path?: string;

  /**
   * Whether to include system information (default: true)
   */
  includeSystemInfo?: boolean;

  /**
   * Whether to include detailed component information (default: true)
   */
  includeDetails?: boolean;

  /**
   * Custom health checks to run
   */
  customChecks?: Array<{
    name: string;
    check: () => Promise<ComponentHealth> | ComponentHealth;
  }>;

  /**
   * Components to exclude from health checks
   */
  excludeComponents?: string[];

  /**
   * Critical components that must be healthy for overall health to be true
   */
  criticalComponents?: string[];
}

/**
 * Health check function type
 */
export type HealthCheckFunction = () => Promise<ComponentHealth> | ComponentHealth;



















