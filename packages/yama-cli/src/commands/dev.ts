import { existsSync } from "fs";
import { dirname, join } from "path";
import { startYamaNodeRuntime, type YamaServer } from "@yama/runtime-node";
import type { FSWatcher } from "chokidar";
import chokidar from "chokidar";
import { findYamaConfig } from "../utils/project-detection.js";
import { generateOnce } from "./generate.js";
import { loadEnvFile } from "@yama/core";

interface DevOptions {
  port?: string;
  watch?: boolean;
  config?: string;
  generate?: boolean;
}

let serverInstance: YamaServer | null = null;
let watcher: FSWatcher | null = null;
let handlerWatcher: FSWatcher | null = null;
let currentPort: number = 4000;
let currentConfigPath: string = "";

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

  // Load .env file
  loadEnvFile(configPath);

  console.log(`🚀 Starting Yama dev server...\n`);
  console.log(`   Config: ${configPath}`);
  console.log(`   Port: ${port}`);
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
  await startServer(port, configPath);

  // Setup watch mode
  if (watch) {
    setupWatchMode(configPath);
  }

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n\n🛑 Shutting down...");
    await cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
  });
}

async function startServer(port: number, configPath: string): Promise<void> {
  try {
    serverInstance = await startYamaNodeRuntime(port, configPath);
    
    // Enhanced startup messages
    console.log(`\n✅ Yama dev server ready!`);
    console.log(`📝 Edit yama.yaml to update API`);
    console.log(`🔄 Changes auto-sync`);
    console.log(`🌐 Server: http://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}/health`);
    console.log(`   Config: http://localhost:${port}/config`);
    console.log(`   📚 Docs: http://localhost:${port}/docs\n`);
  } catch (error) {
    console.error("❌ Failed to start server:", error instanceof Error ? error.message : String(error));
    if (error instanceof Error && error.message.includes("EADDRINUSE")) {
      console.error("\n💡 Port is already in use. Try:");
      console.error(`   yama dev --port ${port + 1}`);
    }
    process.exit(1);
  }
}

function setupWatchMode(configPath: string): void {
  const configDir = dirname(configPath);
  const handlersDir = join(configDir, "src", "handlers");

  console.log("👀 Watching for changes...\n");

  // Watch yama.yaml
  watcher = chokidar.watch(configPath, {
    ignoreInitial: true,
    persistent: true
  });

  watcher.on("change", async (path) => {
    console.log(`\n📝 ${path} changed...`);
    
    try {
      // 1. Regenerate SDK/types
      console.log("   🔄 Regenerating SDK and types...");
      await generateOnce(configPath, {});
      
      // 2. Restart server
      await restartServer();
    } catch (error) {
      console.error("   ❌ Failed to reload:", error instanceof Error ? error.message : String(error));
      console.error("   💡 Fix the error and save again, or restart manually");
    }
  });

  // Watch handlers directory if it exists
  if (existsSync(handlersDir)) {
    handlerWatcher = chokidar.watch(handlersDir, {
      ignoreInitial: true,
      persistent: true
    });

    handlerWatcher.on("change", async (changedPath: string) => {
      console.log(`\n📝 Handler changed: ${changedPath}`);
      await restartServer();
    });
  }

  console.log("   - Watching yama.yaml");
  if (existsSync(handlersDir)) {
    console.log("   - Watching src/handlers/");
  }
}

async function restartServer(): Promise<void> {
  if (!serverInstance) {
    console.log("   ⚠️  No server instance to restart");
    return;
  }

  try {
    // Stop existing server
    console.log("   🛑 Stopping server...");
    await serverInstance.stop();
    serverInstance = null;

    // Small delay to ensure port is released
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start new server
    console.log("   🚀 Restarting server...");
    await startServer(currentPort, currentConfigPath);
  } catch (error) {
    console.error("   ❌ Failed to restart server:", error instanceof Error ? error.message : String(error));
    console.error("   💡 Please restart manually with Ctrl+C and run 'yama dev' again");
  }
}

async function cleanup(): Promise<void> {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }
  if (handlerWatcher) {
    await handlerWatcher.close();
    handlerWatcher = null;
  }
  if (serverInstance) {
    await serverInstance.stop();
    serverInstance = null;
  }
}

