/**
 * Type generation command - generates TypeScript types from yama.yaml schemas
 * 
 * This is a simpler standalone version of the generate command,
 * focused only on type generation from YAML schemas.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname, resolve } from "path";
import chalk from "chalk";
import yaml from "js-yaml";
import { generateTypes, type YamaSchemas } from "@yamajs/kernel";

export interface TypegenOptions {
    config?: string;
    output?: string;
    watch?: boolean;
}

/**
 * Main typegen command entry point
 */
export async function typegenCommand(options: TypegenOptions): Promise<void> {
    const configPath = resolve(options.config || "yama.yaml");

    if (!existsSync(configPath)) {
        console.error(chalk.red(`❌ Config file not found: ${configPath}`));
        console.log(chalk.dim("Run 'yama init' to create a new project"));
        process.exit(1);
    }

    try {
        await generateTypesFromConfig(configPath, options);
        console.log(chalk.green("✅ Types generated successfully"));
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red(`❌ Failed to generate types: ${message}`));
        process.exit(1);
    }
}

/**
 * Generate types from a config file
 */
async function generateTypesFromConfig(
    configPath: string,
    options: TypegenOptions
): Promise<void> {
    // Read and parse YAML
    const yamlContent = readFileSync(configPath, "utf-8");
    const config = yaml.load(yamlContent) as { schemas?: YamaSchemas };

    if (!config.schemas) {
        throw new Error("No schemas found in YAML config");
    }

    // Determine output path
    const configDir = dirname(configPath);
    const outputPath = options.output || "src/types/generated.ts";
    const fullOutputPath = join(configDir, outputPath);

    // Ensure output directory exists
    const outputDir = dirname(fullOutputPath);
    if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
    }

    // Generate types
    const types = generateTypes(config.schemas);

    // Write output
    writeFileSync(fullOutputPath, types, "utf-8");

    console.log(chalk.blue(`📝 Generated types: ${fullOutputPath}`));
    console.log(chalk.dim(`   Schemas: ${Object.keys(config.schemas).length}`));
}

/**
 * CLI command registration helper
 */
export function registerTypegenCommand(program: any): void {
    program
        .command("typegen")
        .description("Generate TypeScript types from yama.yaml schemas")
        .option("-c, --config <path>", "Path to yama.yaml config file", "yama.yaml")
        .option("-o, --output <path>", "Output path for generated types", "src/types/generated.ts")
        .option("-w, --watch", "Watch for changes and regenerate", false)
        .action(async (options: TypegenOptions) => {
            await typegenCommand(options);
        });
}
