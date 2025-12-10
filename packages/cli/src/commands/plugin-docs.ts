import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir } from "../utils/file-utils.ts";
import { success, error, info } from "../utils/cli-utils.ts";
import { loadPlugin, loadPluginFromPackage } from "@betagors/yama-core";
import {
  generatePluginDocs,
  generateMarkdownDocs,
  generateHTMLDocs,
} from "@betagors/yama-core";

interface PluginDocsOptions {
  package: string;
  format?: "markdown" | "html";
  output?: string;
  config?: string;
}

export async function pluginDocsCommand(
  options: PluginDocsOptions
): Promise<void> {
  try {
    const packageName = options.package;
    const format = options.format || "markdown";
    const configPath = options.config || findYamaConfig() || "yama.yaml";
    const configDir = existsSync(configPath) ? getConfigDir(configPath) : process.cwd();

    // Load plugin
    info(`Loading plugin ${packageName}...`);
    const plugin = await loadPlugin(packageName, configDir);
    const manifest = await loadPluginFromPackage(packageName, configDir);

    // Generate documentation
    const docs = generatePluginDocs(plugin, manifest);

    // Generate output
    let output: string;
    let extension: string;

    if (format === "html") {
      output = generateHTMLDocs(docs);
      extension = "html";
    } else {
      output = generateMarkdownDocs(docs);
      extension = "md";
    }

    // Write to file or stdout
    if (options.output) {
      const outputPath = join(configDir, options.output);
      writeFileSync(outputPath, output, "utf-8");
      success(`Documentation written to ${outputPath}`);
    } else {
      console.log(output);
    }
  } catch (err) {
    error(`Failed to generate plugin docs: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}



















