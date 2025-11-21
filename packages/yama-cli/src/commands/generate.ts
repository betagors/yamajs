import { existsSync, writeFileSync } from "fs";
import { join, dirname, relative } from "path";
import { generateTypes, type YamaEntities } from "@yama/core";
import { generateSDK } from "@yama/sdk-ts";
import { generateDrizzleSchema, generateMapper } from "@yama/db-postgres";
import { readYamaConfig, ensureDir, getConfigDir } from "../utils/file-utils.js";
import { findYamaConfig, detectProjectType, inferOutputPath } from "../utils/project-detection.js";
import { generateFrameworkHelpers, updateFrameworkConfig } from "../utils/framework-helpers.js";
import chokidar from "chokidar";

interface GenerateOptions {
  config?: string;
  output?: string;
  watch?: boolean;
  typesOnly?: boolean;
  sdkOnly?: boolean;
  framework?: string;
}

export async function generateCommand(options: GenerateOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    console.error("   Run 'yama init' to create a yama.yaml file");
    process.exit(1);
  }

  const watch = options.watch || false;
  const typesOnly = options.typesOnly || false;
  const sdkOnly = options.sdkOnly || false;

  if (watch) {
    await generateWithWatch(configPath, options);
  } else {
    await generateOnce(configPath, options);
  }
}

export async function generateOnce(configPath: string, options: GenerateOptions): Promise<void> {
  try {
    const config = readYamaConfig(configPath) as { 
      schemas?: unknown; 
      entities?: YamaEntities;
      endpoints?: unknown;
    };
    const configDir = getConfigDir(configPath);
    const projectType = detectProjectType(configDir);

    let typesOutput: string | undefined;

    // Generate types (from both schemas and entities)
    if (!options.sdkOnly && (config.schemas || config.entities)) {
      typesOutput = getTypesOutputPath(configPath, options);
      await generateTypesFile(
        config.schemas as Parameters<typeof generateTypes>[0],
        config.entities,
        typesOutput,
        configDir
      );
    }

    // Generate database code (Drizzle schemas and mappers)
    if (!options.sdkOnly && !options.typesOnly && config.entities) {
      await generateDatabaseCode(config.entities, configDir, typesOutput);
    }

    // Generate SDK
    if (!options.typesOnly && config.endpoints) {
      const sdkOutput = getSdkOutputPath(configPath, options);
      await generateSdkFile(config, sdkOutput, configDir, typesOutput, options.framework);
    }

    // Generate framework helpers if framework is specified
    if (options.framework || projectType !== "unknown") {
      await generateFrameworkHelpers(projectType, options.framework, configDir);
      await updateFrameworkConfig(projectType, options.framework, configDir);
    }

    console.log("\n✅ Generation complete!");
  } catch (error) {
    console.error("❌ Generation failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

async function generateWithWatch(configPath: string, options: GenerateOptions): Promise<void> {
  console.log("👀 Watching for changes...\n");

  const watcher = chokidar.watch(configPath, {
    ignoreInitial: false,
    persistent: true
  });

  watcher.on("change", async () => {
    console.log(`\n📝 ${configPath} changed, regenerating...`);
    await generateOnce(configPath, options);
  });

  // Initial generation
  await generateOnce(configPath, options);

  // Keep process alive
  process.on("SIGINT", async () => {
    await watcher.close();
    process.exit(0);
  });
}

function getTypesOutputPath(configPath: string, options: GenerateOptions): string {
  if (options.output && options.typesOnly) {
    return options.output;
  }

  const configDir = getConfigDir(configPath);
  const projectType = detectProjectType(configDir);
  const inferredPath = inferOutputPath(projectType, "types");
  
  return join(configDir, inferredPath);
}

function getSdkOutputPath(configPath: string, options: GenerateOptions): string {
  if (options.output && options.sdkOnly) {
    return options.output;
  }

  const configDir = getConfigDir(configPath);
  const projectType = detectProjectType(configDir);
  const inferredPath = inferOutputPath(projectType, "sdk");
  
  return join(configDir, inferredPath);
}

async function generateTypesFile(
  schemas: unknown,
  entities: YamaEntities | undefined,
  outputPath: string,
  configDir: string
): Promise<void> {
  try {
    const types = generateTypes(
      schemas as Parameters<typeof generateTypes>[0],
      entities
    );
    const absoluteOutputPath = join(configDir, outputPath);
    const outputDir = dirname(absoluteOutputPath);
    
    ensureDir(outputDir);
    writeFileSync(absoluteOutputPath, types, "utf-8");
    
    console.log(`✅ Generated types: ${outputPath}`);
  } catch (error) {
    console.error("❌ Failed to generate types:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function generateDatabaseCode(
  entities: YamaEntities,
  configDir: string,
  typesOutputPath?: string
): Promise<void> {
  try {
    const dbOutputDir = join(configDir, "src", "generated", "db");
    ensureDir(dbOutputDir);

    // Generate Drizzle schema
    const drizzleSchema = generateDrizzleSchema(entities);
    const drizzleSchemaPath = join(dbOutputDir, "schema.ts");
    writeFileSync(drizzleSchemaPath, drizzleSchema, "utf-8");
    console.log(`✅ Generated Drizzle schema: src/generated/db/schema.ts`);

    // Generate mapper
    let typesImportPath = "../types";
    if (typesOutputPath) {
      const absoluteTypesPath = join(configDir, typesOutputPath);
      const relativePath = relative(dbOutputDir, absoluteTypesPath);
      typesImportPath = relativePath.replace(/\\/g, "/").replace(/\.ts$/, "");
      if (!typesImportPath.startsWith(".")) {
        typesImportPath = "../" + typesImportPath;
      }
    }

    const mapper = generateMapper(entities, typesImportPath);
    const mapperPath = join(dbOutputDir, "mapper.ts");
    writeFileSync(mapperPath, mapper, "utf-8");
    console.log(`✅ Generated mapper: src/generated/db/mapper.ts`);
  } catch (error) {
    console.error("❌ Failed to generate database code:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

async function generateSdkFile(
  config: { schemas?: unknown; endpoints?: unknown },
  outputPath: string,
  configDir: string,
  typesOutputPath?: string,
  framework?: string
): Promise<void> {
  try {
    const absoluteOutputPath = join(configDir, outputPath);
    const outputDir = dirname(absoluteOutputPath);
    
    // Calculate relative path from SDK to types file for import
    let typesImportPath = "./types";
    if (typesOutputPath) {
      const absoluteTypesPath = join(configDir, typesOutputPath);
      const relativePath = relative(outputDir, absoluteTypesPath);
      // Remove .ts extension and normalize path separators
      typesImportPath = relativePath.replace(/\\/g, "/").replace(/\.ts$/, "");
      // Ensure it starts with ./ or ../
      if (!typesImportPath.startsWith(".")) {
        typesImportPath = "./" + typesImportPath;
      }
    }

    const sdkContent = generateSDK(
      config as Parameters<typeof generateSDK>[0],
      {
        baseUrl: process.env.YAMA_API_URL || "http://localhost:3000",
        typesImportPath,
        framework
      }
    );

    ensureDir(outputDir);
    writeFileSync(absoluteOutputPath, sdkContent, "utf-8");
    
    console.log(`✅ Generated SDK: ${outputPath}`);
  } catch (error) {
    console.error("❌ Failed to generate SDK:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

