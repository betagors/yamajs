import { existsSync, writeFileSync, readFileSync } from "fs";
import { join, dirname, relative } from "path";
import { generateTypes, generateHandlerContexts, generateIR, type YamaEntities, type HandlerContextConfig, type AvailableServices, type YamaSchemas, type SchemaDefinition } from "@betagors/yama-core";
import { getDatabasePlugin } from "../utils/db-plugin.ts";
import { readYamaConfig, ensureDir, getConfigDir } from "../utils/file-utils.ts";
import { findYamaConfig, detectProjectType, inferOutputPath } from "../utils/project-detection.ts";
import { generateFrameworkHelpers, updateFrameworkConfig } from "../utils/framework-helpers.ts";
import { getDbDir, getSdkDir, getTypesPath, getCacheDir } from "../utils/paths.ts";
import { getConfigCacheKey, getCachedFile, setCachedFile } from "../utils/cache.ts";
import { updateTypeScriptPaths } from "../utils/tsconfig.ts";
import chokidar from "chokidar";

interface GenerateOptions {
  config?: string;
  output?: string;
  watch?: boolean;
  typesOnly?: boolean;
  sdkOnly?: boolean;
  framework?: string;
  noCache?: boolean;
  ir?: string;
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
  const irPath = options.ir;

  if (watch) {
    await generateWithWatch(configPath, options);
  } else {
    await generateOnce(configPath, options);
  }
}

export async function generateOnce(configPath: string, options: GenerateOptions): Promise<void> {
  try {
    const rawConfig = readYamaConfig(configPath) as { 
      schemas?: unknown; 
      entities?: YamaEntities;
      apis?: unknown;
      endpoints?: unknown;
      operations?: unknown;
      policies?: unknown;
      plugins?: Record<string, Record<string, unknown>> | string[];
      realtime?: {
        entities?: Record<string, any>;
        channels?: Array<any>;
      };
    };
    
    // Normalize config: convert null to undefined, ensure objects are actually objects
    // Note: entities are now extracted from schemas with database properties (legacy entities support removed)
    const config = {
      ...rawConfig,
      schemas: rawConfig.schemas && typeof rawConfig.schemas === 'object' && rawConfig.schemas !== null ? rawConfig.schemas : undefined,
      apis: rawConfig.apis && typeof rawConfig.apis === 'object' && rawConfig.apis !== null ? rawConfig.apis as { rest?: any } : undefined,
      operations: rawConfig.operations && typeof rawConfig.operations === 'object' && rawConfig.operations !== null ? rawConfig.operations : undefined,
      policies: rawConfig.policies && typeof rawConfig.policies === 'object' && rawConfig.policies !== null ? rawConfig.policies : undefined,
      plugins: rawConfig.plugins || undefined,
    };
    
    const configDir = getConfigDir(configPath);
    const projectType = detectProjectType(configDir);
    const cacheDir = getCacheDir(configDir);
    const useCache = !options.noCache;
    const irOutputPath = options.ir;

    // Generate cache key for this config
    const cacheKey = useCache ? getConfigCacheKey(configPath, config) : null;

    let typesOutput: string | undefined;

    // Extract entities from schemas that have database properties
    // Schemas with database.table are treated as entities (legacy entities support removed)
    const allEntities: YamaEntities = extractEntitiesFromSchemas(config.schemas as YamaSchemas | undefined);

    // Emit IR if requested
    if (irOutputPath) {
      const ir = generateIR(config as any);
      await ensureDir(dirname(irOutputPath));
      writeFileSync(irOutputPath, JSON.stringify(ir, null, 2));
      console.log(`✅ IR written to ${irOutputPath}`);
    }

    // Generate types (from schemas - entities are extracted from schemas with database properties)
    if (!options.sdkOnly && config.schemas) {
      typesOutput = getTypesOutputPath(configPath, options);
      await generateTypesFile(
        config.schemas as Parameters<typeof generateTypes>[0],
        undefined, // No explicit entities - they come from schemas
        typesOutput,
        configDir,
        useCache ? cacheDir : undefined,
        cacheKey || undefined
      );
    }

    // Generate handler context types (includes operations converted to endpoints)
    if (!options.sdkOnly && ((config.apis as { rest?: any })?.rest || config.operations)) {
      // Detect available services from configured plugins
      const availableServices = detectAvailableServices(config.plugins);
      // Use merged entities (from both explicit entities and schemas with database properties)
      // Include operations and policies for endpoint generation
      const configWithEntities = {
        ...config,
        entities: allEntities,
        operations: config.operations,
        policies: config.policies,
      } as HandlerContextConfig;
      await generateHandlerContextsFile(
        configWithEntities,
        typesOutput,
        configDir,
        useCache ? cacheDir : undefined,
        cacheKey || undefined,
        availableServices
      );
    }

    // Generate realtime types
    if (!options.sdkOnly && config.realtime) {
      try {
        // @ts-ignore - optional module
        const realtimeModule = await import("@betagors/yama-realtime/typegen").catch(() => null);
        if (!realtimeModule || !realtimeModule.generateRealtimeTypes) {
          console.warn("⚠️  Realtime type generation not available");
        } else {
          const { generateRealtimeTypes } = realtimeModule;
          const realtimeTypes = generateRealtimeTypes(config);
          const realtimeTypesPath = join(configDir, ".yama", "realtime-types.ts");
          const { mkdirSync, writeFileSync } = await import("fs");
          mkdirSync(join(configDir, ".yama"), { recursive: true });
          writeFileSync(realtimeTypesPath, realtimeTypes, "utf-8");
          console.log(`✅ Generated realtime types: ${realtimeTypesPath}`);
        }
      } catch (error) {
        console.warn("⚠️  Failed to generate realtime types:", error instanceof Error ? error.message : String(error));
      }
    }

    // Generate database code (Drizzle schemas and mappers)
    let databaseCodeGenerated = false;
    if (!options.sdkOnly && !options.typesOnly && Object.keys(allEntities).length > 0) {
      try {
        await generateDatabaseCode(allEntities, configDir, typesOutput, config.plugins, configPath);
        databaseCodeGenerated = true;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        if (errorMsg.includes("No database plugin") || errorMsg.includes("database plugin")) {
          console.log("ℹ️  Database code generation skipped (database plugin not installed)");
          console.log("   Install a database plugin (e.g., @betagors/yama-postgres) to generate database code");
          // Show detailed error if available
          if (errorMsg.includes("Errors encountered:")) {
            console.log("\n   Details:");
            const detailsMatch = errorMsg.match(/Errors encountered:([\s\S]*?)(?:\n\n|$)/);
            if (detailsMatch) {
              const details = detailsMatch[1].trim();
              details.split('\n').forEach(line => {
                if (line.trim()) {
                  console.log(`   ${line.trim()}`);
                }
              });
            }
          }
        } else {
          console.warn("⚠️  Failed to generate database code:", errorMsg);
          console.log("   This is optional - you can install a database plugin later if needed");
        }
      }
    }

    // Regenerate handler contexts after database code to include typed entities
    if (databaseCodeGenerated && !options.sdkOnly && (config.apis as { rest?: any })?.rest) {
      try {
        // Detect available services from configured plugins
        const availableServices = detectAvailableServices(config.plugins);
        // Use merged entities (from both explicit entities and schemas with database properties)
        const configWithEntities = {
          ...config,
          entities: allEntities,
        } as HandlerContextConfig;
        await generateHandlerContextsFile(
          configWithEntities,
          typesOutput,
          configDir,
          undefined, // Don't use cache for regeneration
          undefined,
          availableServices
        );
      } catch (error) {
        // Silently fail - handler contexts were already generated earlier
      }
    }

    // Generate framework helpers if framework is specified
    if (options.framework || projectType !== "unknown") {
      await generateFrameworkHelpers(projectType, options.framework, configDir);
      await updateFrameworkConfig(projectType, options.framework, configDir);
    }

    // Generate main index.ts that exports everything
    if (!options.sdkOnly) {
      try {
        await generateMainIndex(
          configDir, 
          allEntities, // Use extracted entities from schemas
          config.apis
        );
      } catch (error) {
        console.warn("⚠️  Failed to generate main index:", error instanceof Error ? error.message : String(error));
      }
    }

    // Update TypeScript paths
    try {
      updateTypeScriptPaths(configDir);
    } catch (error) {
      console.warn("⚠️  Failed to update TypeScript paths:", error instanceof Error ? error.message : String(error));
    }

    console.log("\n✅ Generation complete!");
  } catch (error) {
    console.error("\n❌ Generation failed:", error instanceof Error ? error.message : String(error));
    console.log("\n💡 Tip: Some parts may have succeeded. Check the output above for details.");
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

/**
 * Extract entities from schemas that have database properties
 * Schemas with database.table are treated as entities for database code generation
 */
function extractEntitiesFromSchemas(schemas?: YamaSchemas): YamaEntities {
  const entities: YamaEntities = {};
  
  if (!schemas || typeof schemas !== 'object') {
    return entities;
  }
  
  for (const [schemaName, schemaDef] of Object.entries(schemas)) {
    // Check if schema has database property (indicating it's an entity)
    if (schemaDef && typeof schemaDef === 'object' && 'database' in schemaDef) {
      const dbConfig = (schemaDef as any).database;
      // If database is an object with table property, or if database.table exists
      if (dbConfig && (typeof dbConfig === 'object' && 'table' in dbConfig || typeof dbConfig === 'string')) {
        // Convert schema definition to entity definition
        // The schema fields should already be in entity format
        entities[schemaName] = schemaDef as any;
      }
    }
  }
  
  return entities;
}

/**
 * Detect which services are available based on configured plugins
 */
function detectAvailableServices(
  plugins?: Record<string, Record<string, unknown>> | string[]
): AvailableServices {
  const services: AvailableServices = {};
  
  if (!plugins) {
    return services;
  }

  const pluginList = Array.isArray(plugins) ? plugins : (plugins ? Object.keys(plugins) : []);
  
  for (const pluginName of pluginList) {
    // Database plugins provide db and entities
    if (pluginName === "@betagors/yama-pglite" || pluginName === "@betagors/yama-postgres") {
      services.db = true;
      services.entities = true;
    }
    // Cache plugins provide cache
    else if (pluginName === "@betagors/yama-redis") {
      services.cache = true;
    }
    // Storage plugins provide storage
    else if (pluginName === "@betagors/yama-s3") {
      services.storage = true;
    }
    // Realtime plugins provide realtime
    else if (pluginName === "@betagors/yama-realtime") {
      services.realtime = true;
    }
  }
  
  return services;
}

async function generateHandlerContextsFile(
  config: HandlerContextConfig,
  typesOutputPath: string | undefined,
  configDir: string,
  cacheDir?: string,
  cacheKey?: string,
  availableServices?: AvailableServices
): Promise<void> {
  try {
    // Calculate relative path from handler-contexts.ts to types.ts
    // Both are in .yama/gen/, so they're siblings
    const handlerContextsOutputPath = join(configDir, ".yama", "gen", "handler-contexts.ts");
    let typesImportPath = "./types";
    if (typesOutputPath) {
      const relativePath = relative(dirname(handlerContextsOutputPath), typesOutputPath)
        .replace(/\.ts$/, "")
        .replace(/\\/g, "/");
      // Ensure relative imports start with ./ or ../
      typesImportPath = relativePath.startsWith("./") || relativePath.startsWith("../")
        ? relativePath
        : `./${relativePath}`;
    }

    // Check cache
    if (cacheDir && cacheKey) {
      const cacheKeyForHandlerContexts = `${cacheKey}_handler_contexts`;
      const cached = getCachedFile(cacheDir, cacheKeyForHandlerContexts);
      if (cached) {
        ensureDir(dirname(handlerContextsOutputPath));
        writeFileSync(handlerContextsOutputPath, cached, "utf-8");
        return;
      }
    }

    // Calculate HandlerContext import path - use package name by default
    // This should resolve from node_modules
    const handlerContextImportPath = "@betagors/yama-core";
    
    // Calculate repository types import path (from .yama/gen/handler-contexts.ts to .yama/gen/db/repository-types.ts)
    const repositoryTypesPath = join(configDir, ".yama", "gen", "db", "repository-types.ts");
    let repositoryTypesImportPath: string | undefined;
    if (existsSync(repositoryTypesPath)) {
      const relativePath = relative(dirname(handlerContextsOutputPath), repositoryTypesPath)
        .replace(/\.ts$/, "")
        .replace(/\\/g, "/");
      repositoryTypesImportPath = relativePath.startsWith("./") || relativePath.startsWith("../")
        ? relativePath
        : `./${relativePath}`;
    }
    
    const handlerContexts = generateHandlerContexts(
      config, 
      typesImportPath, 
      handlerContextImportPath, 
      repositoryTypesImportPath,
      availableServices
    );
    ensureDir(dirname(handlerContextsOutputPath));
    writeFileSync(handlerContextsOutputPath, handlerContexts, "utf-8");

    // Save to cache
    if (cacheDir && cacheKey) {
      const cacheKeyForHandlerContexts = `${cacheKey}_handler_contexts`;
      setCachedFile(cacheDir, cacheKeyForHandlerContexts, handlerContexts);
    }

    console.log(`✅ Generated handler contexts: .yama/gen/handler-contexts.ts`);
  } catch (error) {
    console.error("❌ Failed to generate handler contexts:", error instanceof Error ? error.message : String(error));
    // Don't throw - handler contexts are optional
  }
}

// Normalize entities to ensure table names are set
function normalizeEntities(entities: YamaEntities): YamaEntities {
  const normalized: YamaEntities = {};
  
  if (!entities || typeof entities !== 'object' || entities === null) {
    return normalized;
  }
  
  for (const [entityName, entityDef] of Object.entries(entities)) {
    // Handle database shorthand (string) or object
    const dbConfig = typeof entityDef.database === "string"
      ? { table: entityDef.database }
      : entityDef.database;
    
    // Convert entity name to snake_case for table name if not specified
    const defaultTableName = entityName
      .replace(/([A-Z])/g, '_$1')
      .toLowerCase()
      .replace(/^_/, ''); // Remove leading underscore
    
    normalized[entityName] = {
      ...entityDef,
      table: dbConfig?.table || entityDef.table || defaultTableName
    };
  }
  
  return normalized;
}

async function generateDatabaseCode(
  entities: YamaEntities,
  configDir: string,
  typesOutputPath?: string,
  configPlugins?: Record<string, Record<string, unknown>> | string[],
  configPath?: string
): Promise<void> {
  try {
    const dbOutputDir = getDbDir(configDir);
    ensureDir(dbOutputDir);

    // Normalize entities to ensure table names are set
    const normalizedEntities = normalizeEntities(entities);

    // Calculate types import path (from .yama/gen/db/ to .yama/gen/types.ts)
    const typesImportPath = "../types.ts";

    // Generate Drizzle schema
    const dbPlugin = await getDatabasePlugin(configPlugins, configPath);
    const drizzleSchema = dbPlugin.schema.generateDrizzleSchema(normalizedEntities);
    const drizzleSchemaPath = join(dbOutputDir, "schema.ts");
    writeFileSync(drizzleSchemaPath, drizzleSchema, "utf-8");
    console.log(`✅ Generated Drizzle schema: .yama/gen/db/schema.ts`);

    // Generate mapper
    const mapper = dbPlugin.codegen.generateMapper(normalizedEntities, typesImportPath);
    const mapperPath = join(dbOutputDir, "mapper.ts");
    writeFileSync(mapperPath, mapper, "utf-8");
    console.log(`✅ Generated mapper: .yama/gen/db/mapper.ts`);

    // Generate repository
    const { repository, types } = dbPlugin.codegen.generateRepository(normalizedEntities, typesImportPath);
    const repositoryPath = join(dbOutputDir, "repository.ts");
    writeFileSync(repositoryPath, repository, "utf-8");
    console.log(`✅ Generated repository: .yama/gen/db/repository.ts`);

    const repositoryTypesPath = join(dbOutputDir, "repository-types.ts");
    writeFileSync(repositoryTypesPath, types, "utf-8");
    console.log(`✅ Generated repository types: .yama/gen/db/repository-types.ts`);

    // Generate index.ts with exports
    const entityNames = Object.keys(normalizedEntities);
    const indexContent = `// Auto-generated - do not edit
export * from "./schema.ts";
export * from "./mapper.ts";
export * from "./repository.ts";
export * from "./repository-types.ts";

// Re-export repository instances (already created in repository.ts)
${entityNames.map(name => {
  const camelName = name.charAt(0).toLowerCase() + name.slice(1);
  return `export { ${camelName}Repository } from "./repository.ts";`;
}).join("\n")}
`;
    const indexPath = join(dbOutputDir, "index.ts");
    writeFileSync(indexPath, indexContent, "utf-8");
    console.log(`✅ Generated index: .yama/gen/db/index.ts`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    // Don't throw - let the caller handle it gracefully
    throw new Error(`Database code generation failed: ${errorMsg}`);
  }
}

/**
 * Generate main index.ts file that exports all generated types
 */
async function generateMainIndex(
  configDir: string,
  entities?: YamaEntities,
  apis?: { rest?: any }
): Promise<void> {
  try {
    const genDir = join(configDir, ".yama", "gen");
    const indexPath = join(genDir, "index.ts");
    
    // Check what files exist
    const typesPath = join(genDir, "types.ts");
    const handlerContextsPath = join(genDir, "handler-contexts.ts");
    const dbIndexPath = join(genDir, "db", "index.ts");
    const sdkIndexPath = join(genDir, "sdk", "index.ts");
    
    // Check if we have REST endpoints
    const hasRestEndpoints = apis?.rest && (
      (Array.isArray(apis.rest.endpoints) && apis.rest.endpoints.length > 0) ||
      (typeof apis.rest === 'object' && Object.values(apis.rest).some((config: any) => 
        Array.isArray(config?.endpoints) && config.endpoints.length > 0
      ))
    );
    
    const exports: string[] = [];
    
    // Export types if they exist
    if (existsSync(typesPath)) {
      exports.push('export * from "./types.js";');
    }
    
    // Export handler contexts if they exist
    if (existsSync(handlerContextsPath) && hasRestEndpoints) {
      exports.push('export * from "./handler-contexts.js";');
    }
    
    // Export database code if it exists
    if (existsSync(dbIndexPath) && entities && Object.keys(entities).length > 0) {
      exports.push('export * from "./db/index.js";');
    }
    
    // Export SDK if it exists
    if (existsSync(sdkIndexPath) && hasRestEndpoints) {
      exports.push('export * from "./sdk/index.js";');
    }
    
    // Generate index content
    const indexContent = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

// Export all generated types, handlers, database code, and SDK
${exports.length > 0 ? exports.join("\n") : "// No generated files to export"}
`;

    ensureDir(genDir);
    writeFileSync(indexPath, indexContent, "utf-8");
    console.log(`✅ Generated main index: .yama/gen/index.ts`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate main index: ${errorMsg}`);
  }
}

