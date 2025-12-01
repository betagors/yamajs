import { existsSync, readFileSync } from "fs";
import { readYamaConfig, type YAMLError } from "../utils/file-utils.ts";
import { findYamaConfig } from "../utils/project-detection.ts";
import { 
  createSchemaValidator, 
  type YamaSchemas, 
  type YamaEntities,
  entitiesToSchemas,
  mergeSchemas 
} from "@betagors/yama-core";

interface ValidateOptions {
  config?: string;
  strict?: boolean;
}

interface ValidationError {
  message: string;
  line?: number;
  column?: number;
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    console.error(`❌ Config file not found: ${configPath}`);
    process.exit(1);
  }

  console.log(`🔍 Validating ${configPath}...\n`);

  try {
    let config: {
      name?: string;
      version?: string;
      project?: {
        name?: string;
        version?: string;
      };
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
      config = readYamaConfig(configPath) as typeof config;
    } catch (error) {
      const yamlError = error as YAMLError;
      let errorMessage = `❌ Failed to parse YAML: ${yamlError.message || String(error)}`;
      
      if (yamlError.mark) {
        errorMessage += `\n   at line ${yamlError.mark.line + 1}, column ${yamlError.mark.column + 1}`;
      } else if (yamlError.line !== undefined) {
        errorMessage += `\n   at line ${yamlError.line + 1}`;
      }
      
      console.error(errorMessage);
      process.exit(1);
    }

    let isValid = true;
    const errors: ValidationError[] = [];

    // Read file content to find line numbers for errors
    let fileContent: string;
    let fileLines: string[] = [];
    try {
      fileContent = readFileSync(configPath, "utf-8");
      fileLines = fileContent.split("\n");
    } catch {
      // If we can't read the file, continue without line numbers
    }

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

    // Validate basic structure - support both project: and top-level name/version
    const projectName = config.name || config.project?.name;
    const projectVersion = config.version || config.project?.version;

    if (!projectName) {
      const line = findFieldLine("name") || findFieldLine("project");
      errors.push({
        message: "❌ Missing 'name' field (use 'name:' or 'project.name:')",
        line,
      });
      isValid = false;
    }

    if (!projectVersion) {
      const line = findFieldLine("version") || findFieldLine("project");
      errors.push({
        message: "❌ Missing 'version' field (use 'version:' or 'project.version:')",
        line,
      });
      isValid = false;
    }

    // Helper to convert a field from JSON Schema format to internal format
    const convertField = (field: any): any => {
      if (field.$ref) {
        // Convert $ref: "#/schemas/Name" to type: "Name"
        const refMatch = field.$ref.match(/#\/schemas\/(.+)$/);
        if (refMatch) {
          return { type: refMatch[1], ...field, $ref: undefined };
        }
        // Handle other $ref formats
        return { type: field.$ref.replace(/^#\/schemas\//, ""), ...field, $ref: undefined };
      }
      return field;
    };

    // Helper to convert JSON Schema format to internal format
    const convertSchemaFormat = (schemas: Record<string, unknown>): YamaSchemas => {
      const converted: YamaSchemas = {};
      for (const [schemaName, schemaDef] of Object.entries(schemas)) {
        if ((schemaDef as any).type === "object" && (schemaDef as any).properties) {
          // Convert JSON Schema format to internal format
          const fields: Record<string, any> = {};
          for (const [fieldName, fieldDef] of Object.entries((schemaDef as any).properties || {})) {
            fields[fieldName] = convertField(fieldDef);
          }
          converted[schemaName] = { fields };
        } else if ((schemaDef as any).fields) {
          // Already in internal format, but still convert $ref in fields
          const fields: Record<string, any> = {};
          for (const [fieldName, fieldDef] of Object.entries((schemaDef as any).fields || {})) {
            fields[fieldName] = convertField(fieldDef);
          }
          converted[schemaName] = { fields };
        } else {
          // Unknown format, keep as-is
          converted[schemaName] = schemaDef as any;
        }
      }
      return converted;
    };

    // Auto-generate schemas from entities
    let allSchemas: YamaSchemas = {};
    if (config.entities) {
      const entitySchemas = entitiesToSchemas(config.entities);
      const convertedSchemas = config.schemas ? convertSchemaFormat(config.schemas) : undefined;
      allSchemas = mergeSchemas(convertedSchemas, entitySchemas);
      console.log(`✅ Found ${Object.keys(config.entities).length} entity/entities (auto-generated ${Object.keys(entitySchemas).length} schema(s))`);
    } else if (config.schemas) {
      // Convert JSON Schema format (type: object, properties) to internal format (fields) if needed
      allSchemas = convertSchemaFormat(config.schemas);
    }

    // Validate schemas
    if (Object.keys(allSchemas).length > 0) {
      const validator = createSchemaValidator();
      
      try {
        validator.registerSchemas(allSchemas);
        const explicitSchemaCount = config.schemas ? Object.keys(config.schemas).length : 0;
        const entitySchemaCount = config.entities ? Object.keys(entitiesToSchemas(config.entities)).length : 0;
        if (explicitSchemaCount > 0) {
          console.log(`✅ Found ${explicitSchemaCount} explicit schema(s)`);
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
            // Look for $ref: "refName" or $ref: 'refName'
            if (line.includes(`$ref`) && (line.includes(`"${refName}"`) || line.includes(`'${refName}'`))) {
              refLine = i + 1;
              break;
            }
          }
          
          // Check if it's an entity that should have been auto-generated
          const isEntity = config.entities && refName in config.entities;
          if (isEntity) {
            errors.push({
              message: `❌ Schema reference "${refName}" not found, but entity "${refName}" exists. Consider using the entity name directly or ensure the entity has an apiSchema defined.`,
              line: refLine,
            });
          } else {
            errors.push({
              message: `❌ ${errorMessage}`,
              line: refLine,
            });
          }
          isValid = false;
        } else {
          // Other schema validation errors
          errors.push({
            message: `❌ Schema validation error: ${errorMessage}`,
          });
          isValid = false;
        }
      }

      // Validate each schema structure
      // Support both internal format (fields) and JSON Schema format (type: object, properties)
      for (const [schemaName, schemaDef] of Object.entries(allSchemas)) {
        const hasFields = schemaDef.fields && Object.keys(schemaDef.fields).length > 0;
        const hasProperties = (schemaDef as any).type === "object" && (schemaDef as any).properties && Object.keys((schemaDef as any).properties).length > 0;
        
        if (!hasFields && !hasProperties) {
          // Try to find the schema definition line
          let schemaLine: number | undefined;
          for (let i = 0; i < fileLines.length; i++) {
            const line = fileLines[i];
            if (line.trim().startsWith(`${schemaName}:`) || line.includes(`"${schemaName}"`) || line.includes(`'${schemaName}'`)) {
              schemaLine = i + 1;
              break;
            }
          }
          errors.push({
            message: `❌ Schema '${schemaName}' has no fields or properties`,
            line: schemaLine,
          });
          isValid = false;
        } else {
          // Validate schema references within schema fields
          const validateSchemaRefs = (fields: Record<string, unknown>, parentPath: string, startLine: number): void => {
            for (const [fieldName, fieldDef] of Object.entries(fields)) {
              if (typeof fieldDef === "object" && fieldDef !== null) {
                // Check for legacy $ref (deprecated)
                if ("$ref" in fieldDef) {
                  const refName = (fieldDef as { $ref: string }).$ref;
                  if (!allSchemas[refName]) {
                    let refLine: number | undefined;
                    for (let i = startLine - 1; i < fileLines.length; i++) {
                      const line = fileLines[i];
                      if (line.includes(`$ref`) && (line.includes(`"${refName}"`) || line.includes(`'${refName}'`))) {
                        refLine = i + 1;
                        break;
                      }
                    }
                    const isEntity = config.entities && refName in config.entities;
                    errors.push({
                      message: `❌ Schema '${schemaName}' field '${fieldName}' uses deprecated $ref syntax. Use type: "${refName}" instead.${isEntity ? " (entity exists)" : ""}`,
                      line: refLine,
                    });
                    isValid = false;
                  }
                }
                
                // Check for direct type references (new syntax)
                if ("type" in fieldDef) {
                  const typeValue = (fieldDef as { type: unknown }).type;
                  if (typeof typeValue === "string") {
                    // Handle array syntax like "User[]"
                    const arrayMatch = typeValue.match(/^(.+)\[\]$/);
                    if (arrayMatch) {
                      const baseType = arrayMatch[1];
                      if (!allSchemas[baseType]) {
                        let refLine: number | undefined;
                        for (let i = startLine - 1; i < fileLines.length; i++) {
                          const line = fileLines[i];
                          if (line.includes(`type: ${typeValue}`) || line.includes(`type: "${typeValue}"`)) {
                            refLine = i + 1;
                            break;
                          }
                        }
                        const isEntity = config.entities && baseType in config.entities;
                        if (isEntity) {
                          errors.push({
                            message: `❌ Schema '${schemaName}' field '${fieldName}' references "${baseType}" which is an entity but not available as a schema. The entity should be auto-converted to a schema.`,
                            line: refLine,
                          });
                        } else {
                          errors.push({
                            message: `❌ Schema '${schemaName}' field '${fieldName}' references unknown schema: ${baseType} (in array type ${typeValue})`,
                            line: refLine,
                          });
                        }
                        isValid = false;
                      }
                    } else {
                      // Check if it's a direct schema reference (not a primitive type)
                      const primitiveTypes = ["string", "number", "boolean", "integer", "array", "list", "object"];
                      if (!primitiveTypes.includes(typeValue) && !allSchemas[typeValue]) {
                        let refLine: number | undefined;
                        for (let i = startLine - 1; i < fileLines.length; i++) {
                          const line = fileLines[i];
                          if (line.includes(`type: ${typeValue}`) || line.includes(`type: "${typeValue}"`)) {
                            refLine = i + 1;
                            break;
                          }
                        }
                        const isEntity = config.entities && typeValue in config.entities;
                        if (isEntity) {
                          errors.push({
                            message: `❌ Schema '${schemaName}' field '${fieldName}' references "${typeValue}" which is an entity but not available as a schema. The entity should be auto-converted to a schema.`,
                            line: refLine,
                          });
                        } else {
                          errors.push({
                            message: `❌ Schema '${schemaName}' field '${fieldName}' references unknown schema: ${typeValue}`,
                            line: refLine,
                          });
                        }
                        isValid = false;
                      }
                    }
                  }
                }
                
                // Recursively check nested fields
                if ("items" in fieldDef && typeof fieldDef.items === "object" && fieldDef.items !== null) {
                  validateSchemaRefs({ items: fieldDef.items }, `${parentPath}.${fieldName}`, startLine);
                }
                if ("properties" in fieldDef && typeof fieldDef.properties === "object" && fieldDef.properties !== null) {
                  validateSchemaRefs(fieldDef.properties as Record<string, unknown>, `${parentPath}.${fieldName}`, startLine);
                }
              }
            }
          };

          // Find schema start line
          let schemaStartLine: number | undefined;
          for (let i = 0; i < fileLines.length; i++) {
            const line = fileLines[i];
            if (line.trim().startsWith(`${schemaName}:`)) {
              schemaStartLine = i + 1;
              break;
            }
          }

          if (schemaDef.fields && schemaStartLine) {
            validateSchemaRefs(schemaDef.fields, schemaName, schemaStartLine);
          }
        }
      }
    } else {
      console.log("⚠️  No schemas defined");
    }

    // Validate endpoints
    if (config.endpoints) {
      console.log(`✅ Found ${config.endpoints.length} endpoint(s)`);

      for (let idx = 0; idx < config.endpoints.length; idx++) {
        const endpoint = config.endpoints[idx];
        
        // Try to find endpoint line number
        let endpointLine: number | undefined;
        if (fileLines.length > 0) {
          // Look for endpoint entries (usually under "endpoints:" array)
          let endpointsStart = -1;
          for (let i = 0; i < fileLines.length; i++) {
            if (fileLines[i].trim().startsWith("endpoints:")) {
              endpointsStart = i;
              break;
            }
          }
          if (endpointsStart >= 0) {
            // Count endpoint entries to find the right one
            let endpointCount = 0;
            for (let i = endpointsStart + 1; i < fileLines.length; i++) {
              const line = fileLines[i];
              if (line.trim().startsWith("-") && line.includes("path:")) {
                if (endpointCount === idx) {
                  endpointLine = i + 1;
                  break;
                }
                endpointCount++;
              }
            }
          }
        }

        if (!endpoint.path) {
          errors.push({
            message: `❌ Endpoint missing 'path' field`,
            line: endpointLine,
          });
          isValid = false;
        }

        if (!endpoint.method) {
          errors.push({
            message: `❌ Endpoint ${endpoint.path || "unknown"} missing 'method' field`,
            line: endpointLine,
          });
          isValid = false;
        }

        if (!endpoint.handler) {
          errors.push({
            message: `❌ Endpoint ${endpoint.method} ${endpoint.path} missing 'handler' field`,
            line: endpointLine,
          });
          isValid = false;
        }

        // Helper to validate schema type (handles array syntax like "User[]")
        const validateSchemaType = (type: string, context: string): boolean => {
          // Allow generic "object" type
          if (type === "object") {
            return true;
          }
          
          // Handle array syntax like "User[]" or "PostListItem[]"
          const arrayMatch = type.match(/^(.+)\[\]$/);
          if (arrayMatch) {
            const baseType = arrayMatch[1];
            // Check if base type exists as schema or entity
            if (allSchemas[baseType]) {
              return true;
            }
            if (config.entities && baseType in config.entities) {
              return true; // Entity will be auto-converted to schema
            }
            errors.push({
              message: `❌ ${context} references unknown schema: ${baseType} (in array type ${type})`,
              line: endpointLine,
            });
            return false;
          }
          
          // Regular schema reference
          if (allSchemas[type]) {
            return true;
          }
          
          // Check if it's an entity
          if (config.entities && type in config.entities) {
            return true; // Entity will be auto-converted to schema
          }
          
          errors.push({
            message: `❌ ${context} references unknown schema: ${type}`,
            line: endpointLine,
          });
          return false;
        };

        // Validate body/response schema references
        if (endpoint.body?.type) {
          if (!validateSchemaType(endpoint.body.type, `Endpoint ${endpoint.method} ${endpoint.path} body`)) {
            isValid = false;
          }
        }

        if (endpoint.response?.type) {
          if (!validateSchemaType(endpoint.response.type, `Endpoint ${endpoint.method} ${endpoint.path} response`)) {
            isValid = false;
          }
        }
      }
    } else {
      console.log("⚠️  No endpoints defined");
    }

    // Display results
    if (errors.length > 0) {
      console.log("\n❌ Validation errors:\n");
      errors.forEach(error => {
        const lineInfo = error.line ? ` (line ${error.line})` : "";
        console.log(`   ${error.message}${lineInfo}`);
      });
      isValid = false;
    }

    if (isValid) {
      console.log("\n✅ Configuration is valid!");
      process.exit(0);
    } else {
      console.log("\n❌ Configuration has errors");
      process.exit(1);
    }
  } catch (error) {
    console.error("❌ Validation failed:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

