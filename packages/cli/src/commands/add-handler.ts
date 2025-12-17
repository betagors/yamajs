import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { findYamaConfig } from "../utils/project-detection.ts";
import { getConfigDir, readYamaConfig } from "../utils/file-utils.ts";
import { success, error } from "../utils/cli-utils.ts";
import { generateOnce } from "./generate.ts";
import type { YamaSchemas, YamaEntities } from "@yamajs/core";
import type { SchemaField } from "@yamajs/core";

// Local type definition matching HandlerContextConfig
interface HandlerContextConfig {
  schemas?: YamaSchemas;
  entities?: YamaEntities;
  endpoints?: Array<{
    path: string;
    method: string;
    handler?: string;
    description?: string;
    params?: Record<string, SchemaField>;
    query?: Record<string, SchemaField>;
    body?: {
      type?: string;
    };
    response?: {
      type?: string;
    };
    auth?: {
      required?: boolean;
      roles?: string[];
    };
  }>;
}

interface AddHandlerOptions {
  config?: string;
  name?: string;
  force?: boolean;
}

export async function addHandlerCommand(options: AddHandlerOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  if (!options.name) {
    error("Handler name is required. Use --name <name> or -n <name>");
    process.exit(1);
  }

  const handlerName = options.name.trim();

  // Validate handler name
  if (handlerName.length === 0) {
    error("Handler name cannot be empty");
    process.exit(1);
  }

  if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(handlerName)) {
    error("Handler name must be a valid JavaScript identifier");
    process.exit(1);
  }

  try {
    const configDir = getConfigDir(configPath);
    const handlersDir = join(configDir, "src", "handlers");
    const handlerFile = join(handlersDir, `${handlerName}.ts`);

    // Check if handler already exists
    if (existsSync(handlerFile) && !options.force) {
      error(`Handler file already exists: ${handlerFile}`);
      console.log(`   Use --force or -f to override the existing file`);
      process.exit(1);
    }

    // Check if we're overwriting
    const isOverwriting = existsSync(handlerFile);
    if (isOverwriting && options.force) {
      console.log(`âš ï¸  Overwriting existing handler file: ${handlerFile}`);
    }

    // Read YAML config to find endpoint and generate types
    const config = readYamaConfig(configPath) as HandlerContextConfig;
    
    // Find endpoint that uses this handler
    const endpoint = config.endpoints?.find(ep => ep.handler === handlerName);
    
    // Generate handler context type name
    const handlerContextTypeName = handlerName.charAt(0).toUpperCase() + handlerName.slice(1) + "HandlerContext";
    
    // Determine if we should use typed context or generic
    const useTypedContext = endpoint !== undefined;
    const contextType = useTypedContext 
      ? handlerContextTypeName 
      : "HandlerContext";
    
    // Build single import from @yamajs/gen (simpler than separate imports)
    let imports: string;
    if (useTypedContext) {
      const importedTypes = [handlerContextTypeName];
      if (endpoint?.response?.type) {
        importedTypes.push(endpoint.response.type);
      }
      imports = `import type { ${importedTypes.join(", ")} } from "@yamajs/gen";`;
    } else {
      imports = `import type { HandlerContext } from "@yamajs/core";`;
    }

    // Determine return type from endpoint response
    const returnTypeName = endpoint?.response?.type || "unknown";
    const returnType = `Promise<${returnTypeName}>`;

    // Create handler template
    const handlerTemplate = `${imports}

export async function ${handlerName}(
  context: ${contextType}
): ${returnType} {
  // TODO: Implement handler logic
  ${endpoint?.response?.type ? `return {} as ${endpoint.response.type};` : 'return {};'}
}
`;

    // Ensure handlers directory exists
    const { mkdirSync } = await import("fs");
    mkdirSync(handlersDir, { recursive: true });

    writeFileSync(handlerFile, handlerTemplate, "utf-8");
    if (isOverwriting) {
      success(`Handler file overwritten at ${handlerFile}`);
    } else {
      success(`Handler file created at ${handlerFile}`);
    }

    // Generate types and handler contexts if endpoint exists
    if (endpoint) {
      console.log(`\nðŸ“ Found endpoint configuration for handler "${handlerName}"`);
      console.log(`   Generating types and handler contexts...`);
      
      try {
        await generateOnce(configPath, { typesOnly: false });
        console.log(`âœ… Types and handler contexts generated`);
      } catch (genError) {
        // Check if it's just a database plugin issue (non-critical)
        const errorMsg = genError instanceof Error ? genError.message : String(genError);
        if (errorMsg.includes("database plugin") || errorMsg.includes("No database plugin")) {
          console.log(`âœ… Types and handler contexts generated`);
          console.log(`â„¹ï¸  Database code generation skipped (database plugin not installed)`);
          console.log(`   Install a database plugin (e.g., @yamajs/postgres) to generate database code`);
        } else {
          console.warn(`âš ï¸  Failed to generate types: ${errorMsg}`);
          console.log(`   You can run 'yama generate' manually to generate types`);
        }
      }
    } else {
      console.log(`\nâš ï¸  No endpoint found in yama.yaml for handler "${handlerName}"`);
      console.log(`   Using generic HandlerContext type`);
      console.log(`   Add an endpoint in yama.yaml and run 'yama generate' to get typed context`);
    }

    console.log("\nðŸ’¡ Next steps:");
    if (!endpoint) {
      console.log("   1. Add an endpoint in yama.yaml that references this handler");
      console.log("   2. Run 'yama generate' to update types and handler contexts");
    }
    console.log(`   ${endpoint ? '2' : '3'}. Implement the handler logic`);
    console.log(`   ${endpoint ? '3' : '4'}. Run 'yama dev' to test your endpoint`);
  } catch (err) {
    error(`Failed to create handler: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

