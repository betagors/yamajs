import { watch } from "chokidar";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import { schemaCheckCommand } from "./schema-check.ts";
import { schemaGenerateCommand } from "./schema-generate.ts";
import { info, success, error } from "../utils/cli-utils.ts";
import { confirm } from "../utils/interactive.ts";

interface SchemaWatchOptions {
  config?: string;
}

export async function schemaWatchCommand(options: SchemaWatchOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";
  const configDir = getConfigDir(configPath);

  info("Watching for schema changes...");
  info("Press Ctrl+C to stop\n");

  const watcher = watch([configPath, `${configDir}/entities/**/*.yaml`], {
    ignored: /node_modules/,
    persistent: true,
  });

  watcher.on("change", async (path) => {
    console.log(`\n📝 File changed: ${path}`);
    
    try {
      // Run migration:check
      await schemaCheckCommand({ config: options.config, diff: true });
      
      // Prompt to generate migration
      const shouldGenerate = await confirm("Generate migration for these changes?", false);
      if (shouldGenerate) {
        await schemaGenerateCommand({
          config: options.config,
          interactive: true,
        });
      }
    } catch (err) {
      error(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  });

  // Keep process alive
  process.on("SIGINT", () => {
    watcher.close();
    success("\nStopped watching");
    process.exit(0);
  });
}

