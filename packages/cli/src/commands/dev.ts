import { existsSync, statSync } from "fs";
import { dirname, join, relative, extname } from "path";
import { startYamaNodeRuntime, type YamaServer } from "@yama/runtime-node";
import type { FSWatcher } from "chokidar";
import chokidar from "chokidar";
import { findYamaConfig } from "../utils/project-detection.ts";
import { generateOnce } from "./generate.ts";
import { loadEnvFile } from "@yama/core";
import { readYamaConfig } from "../utils/file-utils.ts";

interface DevOptions {
  port?: string;
  watch?: boolean;
  config?: string;
  generate?: boolean;
  env?: string;
}

// State management
let serverInstance: YamaServer | null = null;
let watcher: FSWatcher | null = null;
let currentPort: number = 4000;
let currentConfigPath: string = "";
let currentEnvironment: string = "development";

// Debouncing and restart queue
let restartTimeout: NodeJS.Timeout | null = null;
let isRestarting = false;
let restartQueue: Array<{ type: "config" | "handler"; path: string; timestamp: number }> = [];
let consecutiveFailures = 0;
let isShuttingDown = false;
let lastRestartTime = 0;
let restartCount = 0;

// Adaptive debouncing - adjusts based on file type and change frequency
const DEBOUNCE_DELAYS = {
  config: 300,      // Config files need quick response
  handler: 200,     // Handler files can be faster
  default: 500,     // Default delay
} as const;

const MAX_RETRY_DELAY = 5000; // Max 5 seconds between retries
const MIN_RESTART_INTERVAL = 100; // Minimum time between restarts (ms)

// Track file modification times to avoid unnecessary restarts
const fileModTimes = new Map<string, number>();

// Performance tracking
interface PerformanceMetrics {
  totalRestarts: number;
  averageRestartTime: number;
  lastRestartDuration: number;
}

let metrics: PerformanceMetrics = {
  totalRestarts: 0,
  averageRestartTime: 0,
  lastRestartDuration: 0,
};

// File extensions to watch
const WATCHED_EXTENSIONS = new Set([".ts", ".js", ".yaml", ".yml", ".json", ".mjs", ".cjs"]);

// Comprehensive ignore patterns (based on common .gitignore patterns)
const IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/.yama/**",           // Generated files
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/out/**",
  "**/.turbo/**",
  "**/.vercel/**",
  "**/coverage/**",
  "**/.nyc_output/**",
  "**/*.log",
  "**/*.tsbuildinfo",
  "**/.DS_Store",
  "**/Thumbs.db",
  "**/.env.local",
  "**/.env.*.local",
  "**/secrets.yaml",
  "**/secrets.yml",
  "**/*.secret",
  "**/lib/generated/**",
  "**/generated/**",
  "**/.vscode/**",
  "**/.idea/**",
  "**/*.swp",
  "**/*.swo",
];

export async function devCommand(options: DevOptions): Promise<void> {
  const port = parseInt(options.port || "4000", 10);
  const watch = options.watch !== false; // Default to true
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    console.error("\n💡 Quick fix:");
    console.error("   Run: yama init");
    console.error("   Or:  yama setup");
    process.exit(1);
  }

  currentPort = port;
  currentConfigPath = configPath;

  // Determine environment
  currentEnvironment = options.env || process.env.NODE_ENV || "development";

  // Load .env file with environment support
  loadEnvFile(configPath, currentEnvironment);

  console.log(`🚀 Starting Yama dev server...\n`);
  console.log(`   Config: ${configPath}`);
  console.log(`   Port: ${port}`);
  console.log(`   Environment: ${currentEnvironment}`);
  console.log(`   Watch mode: ${watch ? "enabled" : "disabled"}\n`);

  // Auto-generate SDK/types if requested or in watch mode
  if (options.generate || watch) {
    try {
      console.log("📦 Generating SDK and types...");
      await generateOnce(configPath, {});
      console.log("");
    } catch (error) {
      console.warn("⚠️  Generation failed, continuing anyway:", error instanceof Error ? error.message : String(error));
    }
  }

  // Start the server
  await startServer(port, configPath, currentEnvironment);

  // Setup watch mode
  if (watch) {
    setupWatchMode(configPath);
  }

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      // Force exit if already shutting down
      console.log("\n⚠️  Force exit...");
      process.exit(1);
      return;
    }
    
    isShuttingDown = true;
    console.log(`\n\n🛑 Shutting down (${signal})...`);
    
    // Set a timeout to force exit if cleanup takes too long
    const forceExitTimeout = setTimeout(() => {
      console.log("\n⚠️  Cleanup timeout - forcing exit...");
      process.exit(1);
    }, 5000); // 5 second timeout
    
    try {
      await cleanup();
      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimeout);
      console.error("❌ Error during shutdown:", error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

async function startServer(port: number, configPath: string, environment?: string, isRestart = false): Promise<void> {
  try {
    // Validate config before starting (only on restart)
    if (isRestart) {
      try {
        readYamaConfig(configPath);
      } catch (error) {
        throw new Error(`Invalid YAML config: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    serverInstance = await startYamaNodeRuntime(port, configPath, environment);
    
    // Reset failure counter on successful start
    consecutiveFailures = 0;
    
    // Enhanced startup messages
    if (isRestart) {
      console.log(`   ✅ Server restarted successfully!`);
    } else {
      console.log(`\n✅ Yama dev server ready!`);
      console.log(`📝 Edit yama.yaml to update API`);
      console.log(`🔄 Changes auto-sync`);
      console.log(`🌐 Server: http://localhost:${port}`);
      console.log(`   Health: http://localhost:${port}/health`);
      console.log(`   Config: http://localhost:${port}/config`);
      console.log(`   📚 Docs: http://localhost:${port}/docs\n`);
    }
  } catch (error) {
    consecutiveFailures++;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    if (!isRestart) {
      // Initial startup failure - exit
      console.error("❌ Failed to start server:", errorMessage);
      if (errorMessage.includes("EADDRINUSE")) {
        console.error("\n💡 Port is already in use. Try:");
        console.error(`   yama dev --port ${port + 1}`);
      }
      process.exit(1);
    } else {
      // Restart failure - log but keep watching
      console.error(`   ❌ Failed to restart server (attempt ${consecutiveFailures}):`, errorMessage);
      
      if (errorMessage.includes("EADDRINUSE")) {
        console.error("   💡 Port is still in use. Waiting before retry...");
      } else if (errorMessage.includes("Invalid YAML")) {
        console.error("   💡 Fix the YAML syntax error and save again");
      } else {
        console.error("   💡 Server will retry on next file change");
      }
      
      // Don't throw - keep watching for fixes
      throw error;
    }
  }
}

/**
 * Check if a file should be watched based on extension and path
 */
function shouldWatchFile(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase();
  if (!WATCHED_EXTENSIONS.has(ext)) {
    return false;
  }
  
  // Check against ignore patterns
  const normalizedPath = filePath.replace(/\\/g, "/");
  return !IGNORE_PATTERNS.some(pattern => {
    const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"));
    return regex.test(normalizedPath);
  });
}

/**
 * Get debounce delay based on file type and change frequency
 */
function getDebounceDelay(fileType: "config" | "handler", changeCount: number): number {
  const baseDelay = DEBOUNCE_DELAYS[fileType] || DEBOUNCE_DELAYS.default;
  
  // Increase delay if many rapid changes (throttle spam)
  if (changeCount > 5) {
    return Math.min(baseDelay * 2, 2000);
  }
  
  return baseDelay;
}

/**
 * Check if file actually changed (by comparing mtime)
 * On Windows, file modification times might be cached, so we use a more lenient check
 */
function hasFileChanged(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) {
      return false;
    }
    
    const stats = statSync(filePath);
    const currentMtime = stats.mtimeMs;
    const lastMtime = fileModTimes.get(filePath) || 0;
    
    // Only trigger if mtime actually changed (avoid duplicate events)
    // Use a small threshold (10ms) to account for filesystem timestamp precision issues
    const timeDiff = Math.abs(currentMtime - lastMtime);
    if (timeDiff < 10) {
      return false;
    }
    
    fileModTimes.set(filePath, currentMtime);
    return true;
  } catch {
    // If we can't stat the file, assume it changed (safer to restart)
    return true;
  }
}

/**
 * Setup optimized watch mode with comprehensive patterns
 */
function setupWatchMode(configPath: string): void {
  const configDir = dirname(configPath);
  const handlersDir = join(configDir, "src", "handlers");
  const projectRoot = configDir;

  console.log("👀 Watching for changes...\n");

  // Build watch patterns - consolidated single watcher
  // Normalize paths for cross-platform compatibility (chokidar works better with forward slashes)
  const normalizedConfigPath = configPath.replace(/\\/g, "/");
  const watchPatterns: string[] = [normalizedConfigPath];
  
  // Add handlers directory if it exists
  if (existsSync(handlersDir)) {
    const normalizedHandlersPattern = handlersDir.replace(/\\/g, "/") + "/**/*";
    watchPatterns.push(normalizedHandlersPattern);
  }
  
  // Also watch for new handler files being added
  const srcDir = join(configDir, "src");
  if (existsSync(srcDir)) {
    const normalizedSrcPattern = srcDir.replace(/\\/g, "/") + "/**/*";
    watchPatterns.push(normalizedSrcPattern);
  }

  // On Windows, use polling as fallback for better reliability
  const isWindows = process.platform === "win32";
  
  // Create optimized watcher with ignore patterns
  watcher = chokidar.watch(watchPatterns, {
    ignoreInitial: true,
    persistent: true,
    ignorePermissionErrors: true,
    usePolling: isWindows, // Use polling on Windows for better reliability
    atomic: true,      // Wait for atomic writes to complete
    alwaysStat: false, // Only stat when needed (performance)
    // Only watch specific file extensions
    ignored: (path: string) => {
      // Double-check ignore patterns
      const normalizedPath = path.replace(/\\/g, "/");
      if (IGNORE_PATTERNS.some(pattern => {
        const regex = new RegExp(pattern.replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*"));
        return regex.test(normalizedPath);
      })) {
        return true;
      }
      
      // Check file extension
      return !shouldWatchFile(path);
    },
  });

  // Handle file changes
  watcher.on("change", (filePath: string) => {
    if (isShuttingDown) {
      return;
    }
    
    // Normalize path for consistent comparison
    const normalizedFilePath = filePath.replace(/\\/g, "/");
    
    if (!shouldWatchFile(filePath)) {
      return;
    }
    
    if (!hasFileChanged(filePath)) {
      return; // Duplicate event, ignore
    }
    
    const relativePath = relative(projectRoot, filePath);
    const isConfig = normalizedFilePath === normalizedConfigPath || filePath.endsWith(".yaml") || filePath.endsWith(".yml");
    const changeType: "config" | "handler" = isConfig ? "config" : "handler";
    
    console.log(`\n📝 ${relativePath} changed...`);
    queueRestart({ type: changeType, path: filePath, timestamp: Date.now() });
  });

  // Handle new files being added
  watcher.on("add", (filePath: string) => {
    if (isShuttingDown) {
      return;
    }
    
    // Normalize path for consistent comparison
    const normalizedFilePath = filePath.replace(/\\/g, "/");
    
    if (!shouldWatchFile(filePath)) {
      return;
    }
    
    const relativePath = relative(projectRoot, filePath);
    const isConfig = normalizedFilePath === normalizedConfigPath || filePath.endsWith(".yaml") || filePath.endsWith(".yml");
    const changeType: "config" | "handler" = isConfig ? "config" : "handler";
    
    console.log(`\n➕ ${relativePath} added...`);
    queueRestart({ type: changeType, path: filePath, timestamp: Date.now() });
  });

  // Handle files being removed (might affect imports)
  watcher.on("unlink", (filePath: string) => {
    if (isShuttingDown) {
      return;
    }
    
    if (!shouldWatchFile(filePath)) {
      return;
    }
    
    // Clean up mtime cache
    fileModTimes.delete(filePath);
    
    const relativePath = relative(projectRoot, filePath);
    console.log(`\n🗑️  ${relativePath} removed...`);
    queueRestart({ type: "handler", path: filePath, timestamp: Date.now() });
  });

  // Handle errors gracefully
  watcher.on("error", (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("   ⚠️  Watch error (continuing):", message);
  });

  // Log what we're watching
  console.log("   - Watching yama.yaml");
  if (existsSync(handlersDir)) {
    console.log("   - Watching src/handlers/");
  }
  console.log("   - Ignoring node_modules, .git, dist, build, .yama, etc.");
  console.log("   - Only watching: .ts, .js, .yaml, .yml, .json files\n");
}

/**
 * Queue a restart with adaptive debouncing
 */
function queueRestart(change: { type: "config" | "handler"; path: string; timestamp: number }): void {
  // Prevent duplicate entries for same file
  const existingIndex = restartQueue.findIndex(c => c.path === change.path);
  if (existingIndex >= 0) {
    restartQueue[existingIndex] = change; // Update with latest timestamp
  } else {
    restartQueue.push(change);
  }
  
  // Clear existing timeout
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  
  // Calculate adaptive debounce delay
  const configChanges = restartQueue.filter(c => c.type === "config").length;
  const handlerChanges = restartQueue.filter(c => c.type === "handler").length;
  const hasConfigChange = configChanges > 0;
  const delay = getDebounceDelay(hasConfigChange ? "config" : "handler", restartQueue.length);
  
  // Set new debounced timeout
  restartTimeout = setTimeout(() => {
    processRestartQueue();
  }, delay);
}

/**
 * Process the restart queue with rate limiting
 */
async function processRestartQueue(): Promise<void> {
  // Don't process if shutting down
  if (isShuttingDown) {
    return;
  }
  
  // Clear timeout
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  
  // If already restarting, queue will be processed after current restart
  if (isRestarting) {
    return;
  }
  
  // Rate limiting - prevent restarts too close together
  const now = Date.now();
  const timeSinceLastRestart = now - lastRestartTime;
  if (timeSinceLastRestart < MIN_RESTART_INTERVAL) {
    // Reschedule for later
    restartTimeout = setTimeout(() => {
      processRestartQueue();
    }, MIN_RESTART_INTERVAL - timeSinceLastRestart);
    return;
  }
  
  // Get latest change from queue
  const changes = [...restartQueue];
  restartQueue = [];
  
  if (changes.length === 0) {
    return;
  }
  
  // Find if any change is a config change (requires regeneration)
  const hasConfigChange = changes.some(c => c.type === "config");
  const latestChange = changes[changes.length - 1];
  
  // Update last restart time
  lastRestartTime = now;
  
  await performRestart(hasConfigChange, latestChange);
}

/**
 * Perform the actual restart with error recovery and performance tracking
 */
async function performRestart(regenerate: boolean, change: { type: "config" | "handler"; path: string; timestamp: number }): Promise<void> {
  if (isRestarting || isShuttingDown) {
    return;
  }
  
  isRestarting = true;
  const startTime = Date.now();
  restartCount++;
  
  try {
    // 1. Regenerate SDK/types if config changed
    if (regenerate) {
      try {
        console.log("   🔄 Regenerating SDK and types...");
        const genStart = Date.now();
        await generateOnce(currentConfigPath, {});
        const genDuration = Date.now() - genStart;
        if (genDuration > 1000) {
          console.log(`   ✅ Generated in ${(genDuration / 1000).toFixed(2)}s`);
        }
      } catch (error) {
        console.warn("   ⚠️  Generation failed, continuing with restart:", error instanceof Error ? error.message : String(error));
        // Continue anyway - generation errors shouldn't block restart
      }
    }
    
    // 2. Restart server with retry logic
    await restartServerWithRetry();
    
    // Track performance
    const duration = Date.now() - startTime;
    metrics.lastRestartDuration = duration;
    metrics.totalRestarts = restartCount;
    metrics.averageRestartTime = (metrics.averageRestartTime * (restartCount - 1) + duration) / restartCount;
    
    // Show performance hint if restarts are slow
    if (duration > 3000 && restartCount % 5 === 0) {
      console.log(`   ⚡ Average restart time: ${metrics.averageRestartTime.toFixed(0)}ms`);
    }
    
  } catch (error) {
    // Error already logged in restartServerWithRetry
    // Keep watching for fixes
  } finally {
    isRestarting = false;
    
    // Process any queued changes that happened during restart
    if (restartQueue.length > 0) {
      // Small delay before processing queue to avoid rapid restarts
      setTimeout(() => {
        processRestartQueue();
      }, 300);
    }
  }
}

/**
 * Restart server with exponential backoff retry
 */
async function restartServerWithRetry(): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  
  if (!serverInstance) {
    console.log("   ⚠️  No server instance to restart");
    return;
  }

  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Stop existing server
      const instance = serverInstance;
      if (instance) {
        console.log("   🛑 Stopping server...");
        try {
          await instance.stop();
        } catch (error) {
          // Ignore stop errors - server might already be stopped
          console.warn("   ⚠️  Error stopping server (continuing):", error instanceof Error ? error.message : String(error));
        }
      }
      serverInstance = null;

      // Calculate delay based on consecutive failures (exponential backoff)
      const delay = Math.min(1000 * Math.pow(2, consecutiveFailures), MAX_RETRY_DELAY);
      if (delay > 1000) {
        console.log(`   ⏳ Waiting ${delay}ms before restart (backoff)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Standard delay to ensure port is released
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Start new server
      console.log("   🚀 Restarting server...");
      await startServer(currentPort, currentConfigPath, currentEnvironment, true);
      
      // Success - exit retry loop
      return;
      
    } catch (error) {
      attempt++;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (attempt < maxRetries) {
        // Calculate retry delay (exponential backoff)
        const retryDelay = Math.min(1000 * Math.pow(2, attempt), MAX_RETRY_DELAY);
        console.log(`   ⏳ Retry ${attempt}/${maxRetries} in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      } else {
        // Max retries reached
        console.error(`   ❌ Failed to restart after ${maxRetries} attempts`);
        console.error("   💡 The server will keep watching for changes");
        console.error("   💡 Fix the error and save again to retry");
        console.error("   💡 Or press Ctrl+C and restart manually");
        throw error;
      }
    }
  }
}


async function cleanup(): Promise<void> {
  // Clear any pending restarts
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  
  // Set isRestarting to false to prevent new restarts
  isRestarting = false;
  
  // Wait for any in-progress restart to complete (with shorter timeout)
  let waitCount = 0;
  while (isRestarting && waitCount < 20) { // Reduced from 50 to 20 (2 seconds max)
    await new Promise(resolve => setTimeout(resolve, 100));
    waitCount++;
  }
  
  // Stop server first (most important)
  const instance = serverInstance;
  if (instance) {
    try {
      // Add timeout for server stop
      await Promise.race([
        instance.stop(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Server stop timeout")), 2000)
        )
      ]);
    } catch (error) {
      // Ignore stop errors during cleanup
      if (error instanceof Error && !error.message.includes("timeout")) {
        console.warn("⚠️  Error stopping server:", error.message);
      }
    }
    serverInstance = null;
  }
  
  // Close watcher with timeout
  if (watcher) {
    try {
      await Promise.race([
        watcher.close(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Watcher close timeout")), 1000)
        )
      ]);
    } catch (error) {
      // Ignore close errors
    }
    watcher = null;
  }
  
  // Clear file modification time cache
  fileModTimes.clear();
  
  // Log performance summary if we had restarts
  if (metrics.totalRestarts > 0) {
    console.log(`\n📊 Watch mode stats: ${metrics.totalRestarts} restarts, avg ${metrics.averageRestartTime.toFixed(0)}ms`);
  }
}

