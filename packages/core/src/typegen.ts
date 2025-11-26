import type { SchemaField, SchemaDefinition, YamaSchemas } from "./schemas.js";
import type { YamaEntities } from "./entities.js";
import { entitiesToSchemas, mergeSchemas } from "./entities.js";

/**
 * Convert a Yama schema field to TypeScript type string
 */
function fieldToTypeScript(
  field: SchemaField,
  indent = 0,
  schemas?: YamaSchemas,
  visited: Set<string> = new Set()
): string {
  const spaces = "  ".repeat(indent);
  
  // Handle schema references
  if (field.$ref) {
    if (visited.has(field.$ref)) {
      throw new Error(`Circular reference detected in type generation: ${field.$ref}`);
    }
    
    if (!schemas || !schemas[field.$ref]) {
      throw new Error(`Schema reference "${field.$ref}" not found in type generation`);
    }
    
    // Return the referenced schema name directly
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
        const itemType = fieldToTypeScript(field.items, indent, schemas, visited);
        return `${itemType}[]`;
      }
      return "unknown[]";
    
    case "object":
      if (field.properties) {
        const props: string[] = [];
        for (const [propName, propField] of Object.entries(field.properties)) {
          const propType = fieldToTypeScript(propField, indent + 1, schemas, visited);
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
 * Generate TypeScript type definition for a schema
 */
function generateSchemaType(
  schemaName: string,
  schemaDef: SchemaDefinition,
  schemas?: YamaSchemas,
  visited: Set<string> = new Set()
): string {
  const fields: string[] = [];
  
  for (const [fieldName, field] of Object.entries(schemaDef.fields)) {
    const fieldType = fieldToTypeScript(field, 1, schemas, visited);
    const optional = field.required ? "" : "?";
    fields.push(`  ${fieldName}${optional}: ${fieldType};`);
  }
  
  return `export interface ${schemaName} {\n${fields.join("\n")}\n}`;
}

/**
 * Generate TypeScript types from Yama schemas and entities
 */
export function generateTypes(
  schemas?: YamaSchemas,
  entities?: YamaEntities
): string {
  const imports = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

`;

  // Convert entities to schemas and merge with explicit schemas
  const entitySchemas = entities ? entitiesToSchemas(entities) : {};
  const allSchemas = mergeSchemas(schemas, entitySchemas);

  const typeDefinitions: string[] = [];
  
  for (const [schemaName, schemaDef] of Object.entries(allSchemas)) {
    typeDefinitions.push(generateSchemaType(schemaName, schemaDef, allSchemas));
  }
  
  return imports + typeDefinitions.join("\n\n") + "\n";
}

