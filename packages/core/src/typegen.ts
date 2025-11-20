import type { ModelField, ModelDefinition, YamaModels } from "./models.js";

/**
 * Convert a Yama model field to TypeScript type string
 */
function fieldToTypeScript(
  field: ModelField,
  indent = 0,
  models?: YamaModels,
  visited: Set<string> = new Set()
): string {
  const spaces = "  ".repeat(indent);
  
  // Handle model references
  if (field.$ref) {
    if (visited.has(field.$ref)) {
      throw new Error(`Circular reference detected in type generation: ${field.$ref}`);
    }
    
    if (!models || !models[field.$ref]) {
      throw new Error(`Model reference "${field.$ref}" not found in type generation`);
    }
    
    // Return the referenced model name directly
    return field.$ref;
  }
  
  // Type is required if $ref is not present
  if (!field.type) {
    throw new Error(`Field must have either a type or $ref`);
  }
  
  switch (field.type) {
    case "string":
      // Handle enum types
      if (field.enum && Array.isArray(field.enum)) {
        const enumValues = field.enum
          .map((val) => (typeof val === "string" ? `"${val}"` : String(val)))
          .join(" | ");
        return enumValues;
      }
      return "string";
    
    case "number":
    case "integer":
      // Handle enum types for numbers
      if (field.enum && Array.isArray(field.enum)) {
        const enumValues = field.enum.map((val) => String(val)).join(" | ");
        return enumValues;
      }
      return "number";
    
    case "boolean":
      // Handle enum types for booleans
      if (field.enum && Array.isArray(field.enum)) {
        const enumValues = field.enum.map((val) => String(val)).join(" | ");
        return enumValues;
      }
      return "boolean";
    
    case "array":
      if (field.items) {
        const itemType = fieldToTypeScript(field.items, indent, models, visited);
        return `${itemType}[]`;
      }
      return "unknown[]";
    
    case "object":
      if (field.properties) {
        const props: string[] = [];
        for (const [propName, propField] of Object.entries(field.properties)) {
          const propType = fieldToTypeScript(propField, indent + 1, models, visited);
          const optional = propField.required ? "" : "?";
          props.push(`${spaces}  ${propName}${optional}: ${propType};`);
        }
        return `{\n${props.join("\n")}\n${spaces}}`;
      }
      return "Record<string, unknown>";
    
    default:
      return "unknown";
  }
}

/**
 * Generate TypeScript type definition for a model
 */
function generateModelType(
  modelName: string,
  modelDef: ModelDefinition,
  models?: YamaModels,
  visited: Set<string> = new Set()
): string {
  const fields: string[] = [];
  
  for (const [fieldName, field] of Object.entries(modelDef.fields)) {
    const fieldType = fieldToTypeScript(field, 1, models, visited);
    const optional = field.required ? "" : "?";
    fields.push(`  ${fieldName}${optional}: ${fieldType};`);
  }
  
  return `export interface ${modelName} {\n${fields.join("\n")}\n}`;
}

/**
 * Generate TypeScript types from Yama models
 */
export function generateTypes(models: YamaModels): string {
  const imports = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

`;

  const typeDefinitions: string[] = [];
  
  for (const [modelName, modelDef] of Object.entries(models)) {
    typeDefinitions.push(generateModelType(modelName, modelDef, models));
  }
  
  return imports + typeDefinitions.join("\n\n") + "\n";
}

