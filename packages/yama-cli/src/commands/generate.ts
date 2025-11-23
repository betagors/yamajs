import { existsSync, writeFileSync, readFileSync } from "fs";
import { join, dirname, relative } from "path";
import { generateTypes, type YamaEntities } from "@yama/core";
import { generateSDK } from "@yama/sdk-ts";
import { getDatabasePlugin } from "../utils/db-plugin.js";
import { readYamaConfig, ensureDir, getConfigDir } from "../utils/file-utils.js";
import { findYamaConfig, detectProjectType, inferOutputPath } from "../utils/project-detection.js";
import { generateFrameworkHelpers, updateFrameworkConfig } from "../utils/framework-helpers.js";
import { getDbDir, getSdkDir, getTypesPath, getCacheDir } from "../utils/paths.js";
import { getConfigCacheKey, getCachedFile, setCachedFile } from "../utils/cache.js";
import { updateTypeScriptPaths } from "../utils/tsconfig.js";
import chokidar from "chokidar";

interface GenerateOptions {
  config?: string;
  output?: string;
  watch?: boolean;
  typesOnly?: boolean;
  sdkOnly?: boolean;
  framework?: string;
  noCache?: boolean;
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
    const cacheDir = getCacheDir(configDir);
    const useCache = !options.noCache;

    // Generate cache key for this config
    const cacheKey = useCache ? getConfigCacheKey(configPath, config) : null;

    let typesOutput: string | undefined;

    // Generate types (from both schemas and entities)
    if (!options.sdkOnly && (config.schemas || config.entities)) {
      typesOutput = getTypesOutputPath(configPath, options);
      await generateTypesFile(
        config.schemas as Parameters<typeof generateTypes>[0],
        config.entities,
        typesOutput,
        configDir,
        useCache ? cacheDir : undefined,
        cacheKey || undefined
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

    // Update TypeScript paths
    updateTypeScriptPaths(configDir);

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
  return getTypesPath(configDir);
}

function getSdkOutputPath(configPath: string, options: GenerateOptions): string {
  if (options.output && options.sdkOnly) {
    return options.output;
  }

  const configDir = getConfigDir(configPath);
  return join(getSdkDir(configDir), "client.ts");
}

async function generateTypesFile(
  schemas: unknown,
  entities: YamaEntities | undefined,
  outputPath: string,
  configDir: string,
  cacheDir?: string,
  cacheKey?: string
): Promise<void> {
  try {
    // Check cache
    if (cacheDir && cacheKey) {
      const cacheKeyForTypes = `${cacheKey}_types`;
      const cached = getCachedFile(cacheDir, cacheKeyForTypes);
      if (cached) {
        const absoluteOutputPath = outputPath.startsWith(configDir) ? outputPath : join(configDir, outputPath);
        ensureDir(dirname(absoluteOutputPath));
        writeFileSync(absoluteOutputPath, cached, "utf-8");
        return;
      }
    }

    const types = generateTypes(
      schemas as Parameters<typeof generateTypes>[0],
      entities
    );
    const absoluteOutputPath = outputPath.startsWith(configDir) ? outputPath : join(configDir, outputPath);
    const outputDir = dirname(absoluteOutputPath);
    
    ensureDir(outputDir);
    writeFileSync(absoluteOutputPath, types, "utf-8");
    
    // Save to cache
    if (cacheDir && cacheKey) {
      const cacheKeyForTypes = `${cacheKey}_types`;
      setCachedFile(cacheDir, cacheKeyForTypes, types);
    }
    
    console.log(`✅ Generated types: ${outputPath.replace(configDir + "/", "")}`);
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
    const dbOutputDir = getDbDir(configDir);
    ensureDir(dbOutputDir);

    // Calculate types import path (from .yama/db/ to .yama/types.ts)
    const typesImportPath = "../types";

    // Generate Drizzle schema
    const dbPlugin = await getDatabasePlugin();
    const drizzleSchema = dbPlugin.schema.generateDrizzleSchema(entities);
    const drizzleSchemaPath = join(dbOutputDir, "schema.ts");
    writeFileSync(drizzleSchemaPath, drizzleSchema, "utf-8");
    console.log(`✅ Generated Drizzle schema: .yama/db/schema.ts`);

    // Generate mapper
    const mapper = dbPlugin.codegen.generateMapper(entities, typesImportPath);
    const mapperPath = join(dbOutputDir, "mapper.ts");
    writeFileSync(mapperPath, mapper, "utf-8");
    console.log(`✅ Generated mapper: .yama/db/mapper.ts`);

    // Generate repository
    const { repository, types } = dbPlugin.codegen.generateRepository(entities, typesImportPath);
    const repositoryPath = join(dbOutputDir, "repository.ts");
    writeFileSync(repositoryPath, repository, "utf-8");
    console.log(`✅ Generated repository: .yama/db/repository.ts`);

    const repositoryTypesPath = join(dbOutputDir, "repository-types.ts");
    writeFileSync(repositoryTypesPath, types, "utf-8");
    console.log(`✅ Generated repository types: .yama/db/repository-types.ts`);

    // Generate index.ts with exports
    const entityNames = Object.keys(entities);
    const indexContent = `// Auto-generated - do not edit
export * from "./schema";
export * from "./mapper";
export * from "./repository";
export * from "./repository-types";

// Re-export repository instances (already created in repository.ts)
${entityNames.map(name => {
  const camelName = name.charAt(0).toLowerCase() + name.slice(1);
  return `export { ${camelName}Repository } from "./repository";`;
}).join("\n")}
`;
    const indexPath = join(dbOutputDir, "index.ts");
    writeFileSync(indexPath, indexContent, "utf-8");
    console.log(`✅ Generated index: .yama/db/index.ts`);
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
    const absoluteOutputPath = outputPath.startsWith(configDir) ? outputPath : join(configDir, outputPath);
    const outputDir = dirname(absoluteOutputPath);
    
    // Calculate relative path from SDK to types file for import
    // From .yama/sdk/ to .yama/types.ts
    const typesImportPath = "../types";

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
    console.log(`✅ Generated SDK: ${outputPath.replace(configDir + "/", "")}`);

    // Generate index.ts for SDK
    const sdkDir = getSdkDir(configDir);
    const indexContent = `// Auto-generated - do not edit
export * from "./client";
`;
    const indexPath = join(sdkDir, "index.ts");
    writeFileSync(indexPath, indexContent, "utf-8");
    console.log(`✅ Generated index: .yama/sdk/index.ts`);
  } catch (error) {
    console.error("❌ Failed to generate SDK:", error instanceof Error ? error.message : String(error));
    throw error;
  }
}

