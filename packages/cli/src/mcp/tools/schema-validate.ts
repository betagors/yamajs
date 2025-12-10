import { z } from "zod";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { readYamaConfig, type YAMLError } from "../../utils/file-utils.ts";
import { findYamaConfig } from "../../utils/project-detection.ts";
import { 
  createSchemaValidator, 
  type YamaSchemas, 
  type YamaEntities,
  entitiesToSchemas,
  mergeSchemas 
} from "@betagors/yama-core";

const inputSchema = z.object({
  schema: z.string().optional().describe("Raw YAML schema content to validate (entities section or full yama.yaml content)"),
  config: z.string().optional().describe("Path to yama.yaml file to validate (if schema not provided)"),
  strict: z.boolean().optional().describe("Enable strict validation"),
});

interface ValidationError {
  message: string;
  line?: number;
  column?: number;
}

async function validateYamlContent(yamlContent: string, strict = false): Promise<{
  isValid: boolean;
  errors: ValidationError[];
  output: string;
}> {
  const errors: ValidationError[] = [];
  let isValid = true;
  const outputLines: string[] = [];
  
  // Parse YAML content
  let config: {
    name?: string;
    version?: string;
    schemas?: YamaSchemas;
    entities?: YamaEntities;
    endpoints?: Array<{
      path: string;
      method: string;
      handler: string;
      params?: unknown;
      query?: unknown;
      body?: { type: string };
      response?: { type: string };
    }>;
  };

  try {
    // Write to temp file and read it
    const tempFile = join(tmpdir(), `yama-validate-${Date.now()}.yaml`);
    writeFileSync(tempFile, yamlContent, "utf-8");
    
    try {
      config = readYamaConfig(tempFile) as typeof config;
    } finally {
      // Clean up temp file
      try {
        unlinkSync(tempFile);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    const yamlError = error as YAMLError;
    let errorMessage = `Failed to parse YAML: ${yamlError.message || String(error)}`;
    
    if (yamlError.mark) {
      errorMessage += `\n   at line ${yamlError.mark.line + 1}, column ${yamlError.mark.column + 1}`;
      errors.push({
        message: errorMessage,
        line: yamlError.mark.line + 1,
        column: yamlError.mark.column + 1,
      });
    } else if (yamlError.line !== undefined) {
      errorMessage += `\n   at line ${yamlError.line + 1}`;
      errors.push({
        message: errorMessage,
        line: yamlError.line + 1,
      });
    } else {
      errors.push({
        message: errorMessage,
      });
    }
    
    isValid = false;
    return { isValid, errors, output: errorMessage };
  }

  const fileLines = yamlContent.split("\n");

  // Helper to find line number for a field
  const findFieldLine = (fieldName: string, startLine = 0): number | undefined => {
    for (let i = startLine; i < fileLines.length; i++) {
      const line = fileLines[i];
      if (line.trim().startsWith(`${fieldName}:`)) {
        return i + 1; // 1-based line numbers
      }
    }
    return undefined;
  };

  // Validate basic structure (only if it looks like a full config)
  if (yamlContent.includes("name:") || yamlContent.includes("version:")) {
    if (!config.name) {
      const line = findFieldLine("name");
      errors.push({
        message: "Missing 'name' field",
        line,
      });
      isValid = false;
    }

    if (!config.version && !config.project?.version) {
      const line = findFieldLine("version");
      errors.push({
        message: "Missing 'version' field (or project.version)",
        line,
      });
      isValid = false;
    }
  }

  // Auto-generate schemas from entities
  let allSchemas: YamaSchemas = {};
  if (config.entities) {
    try {
      const entitySchemas = entitiesToSchemas(config.entities);
      allSchemas = mergeSchemas(config.schemas, entitySchemas);
      outputLines.push(`✅ Found ${Object.keys(config.entities).length} entity/entities (auto-generated ${Object.keys(entitySchemas).length} schema(s))`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        message: `Failed to convert entities to schemas: ${errorMessage}`,
      });
      isValid = false;
    }
  } else if (config.schemas) {
    allSchemas = config.schemas;
  }

  // Validate schemas
  if (Object.keys(allSchemas).length > 0) {
    const validator = createSchemaValidator();
    
    try {
      validator.registerSchemas(allSchemas);
      const explicitSchemaCount = config.schemas ? Object.keys(config.schemas).length : 0;
      if (explicitSchemaCount > 0) {
        outputLines.push(`✅ Found ${explicitSchemaCount} explicit schema(s)`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Check if it's a schema reference error
      const schemaRefMatch = errorMessage.match(/Schema reference "([^"]+)" not found/);
      if (schemaRefMatch) {
        const refName = schemaRefMatch[1];
        // Find the line where this reference is used
        let refLine: number | undefined;
        for (let i = 0; i < fileLines.length; i++) {
          const line = fileLines[i];
          if (line.includes(`$ref`) && (line.includes(`"${refName}"`) || line.includes(`'${refName}'`))) {
            refLine = i + 1;
            break;
          }
        }
        
        errors.push({
          message: `Schema reference "${refName}" not found${refLine ? ` (referenced at line ${refLine})` : ""}`,
          line: refLine,
        });
      } else {
        errors.push({
          message: `Schema validation error: ${errorMessage}`,
        });
      }
      isValid = false;
    }
  }

  // Validate entities structure
  if (config.entities) {
    try {
      // Basic entity structure validation
      for (const [entityName, entityDef] of Object.entries(config.entities)) {
        if (!entityDef.table) {
          errors.push({
            message: `Entity "${entityName}" is missing required 'table' field`,
          });
          isValid = false;
        }
        if (!entityDef.fields || Object.keys(entityDef.fields).length === 0) {
          errors.push({
            message: `Entity "${entityName}" is missing required 'fields' section`,
          });
          isValid = false;
        }
      }
      
      if (isValid) {
        outputLines.push(`✅ All entities have valid structure`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      errors.push({
        message: `Entity validation error: ${errorMessage}`,
      });
      isValid = false;
    }
  }

  // Validate endpoints
  if (config.endpoints) {
    const endpointErrors: string[] = [];
    for (const endpoint of config.endpoints) {
      if (!endpoint.path) {
        endpointErrors.push("Endpoint missing 'path' field");
      }
      if (!endpoint.method) {
        endpointErrors.push("Endpoint missing 'method' field");
      }
      if (!endpoint.handler) {
        endpointErrors.push("Endpoint missing 'handler' field");
      }
    }
    
    if (endpointErrors.length > 0) {
      errors.push({
        message: `Endpoint validation errors: ${endpointErrors.join(", ")}`,
      });
      isValid = false;
    } else {
      outputLines.push(`✅ Found ${config.endpoints.length} endpoint(s)`);
    }
  }

  const output = outputLines.join("\n");
  return { isValid, errors, output };
}

export const yamaSchemaValidateTool = {
  name: "yama_schema_validate",
  description: "Validates YAML schema syntax and structure. Can validate raw YAML schema content (passed as a string) or a yama.yaml file. Use this tool when the user asks to validate schema, check schema syntax, validate YAML schema, or verify entity definitions. Supports both raw YAML strings and file paths.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    if (!args.schema && !args.config) {
      return {
        content: [
          {
            type: "text" as const,
            text: "❌ Error: Either 'schema' (raw YAML content) or 'config' (file path) must be provided",
          },
        ],
      };
    }

    try {
      let yamlContent: string;
      let source: string;

      if (args.schema) {
        // Validate raw YAML string
        yamlContent = args.schema;
        source = "provided YAML content";
      } else if (args.config) {
        // Validate file
        const configPath = args.config || findYamaConfig() || "yama.yaml";
        
        if (!existsSync(configPath)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `❌ Config file not found: ${configPath}`,
              },
            ],
          };
        }
        
        yamlContent = readFileSync(configPath, "utf-8");
        source = configPath;
      } else {
        throw new Error("Either schema or config must be provided");
      }

      const result = await validateYamlContent(yamlContent, args.strict);
      
      const errorMessages = result.errors.length > 0
        ? "\n\nErrors:\n" + result.errors.map(e => {
            const location = e.line 
              ? ` (line ${e.line}${e.column ? `, column ${e.column}` : ""})`
              : "";
            return `  - ${e.message}${location}`;
          }).join("\n")
        : "";

      const output = result.isValid
        ? `✅ Validation successful for ${source}\n\n${result.output}`
        : `❌ Validation failed for ${source}\n\n${result.output}${errorMessages}`;

      return {
        content: [
          {
            type: "text" as const,
            text: output,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Validation error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};
