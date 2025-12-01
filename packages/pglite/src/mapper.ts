import type { YamaEntities, EntityDefinition, EntityField } from "@betagors/yama-core";
import { parseFieldDefinition } from "@betagors/yama-core";

/**
 * Convert snake_case to camelCase
 */
function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Get API field name from entity field
 */
function getApiFieldName(fieldName: string, field: EntityField): string | null {
  // Exclude if api is explicitly false
  if (field.api === false) {
    return null;
  }

  // Use explicit api name if provided
  if (field.api && typeof field.api === "string") {
    return field.api;
  }

  // Convert dbColumn to camelCase if provided
  if (field.dbColumn) {
    return snakeToCamel(field.dbColumn);
  }

  // Use field name as-is
  return fieldName;
}

/**
 * Generate mapper function for a single entity
 */
function generateEntityMapper(entityName: string, entityDef: EntityDefinition, availableEntities: Set<string>): string {
  const mappings: string[] = [];
  const apiSchemaName = entityDef.apiSchema || entityName;

  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
    // Skip inline relations
    if (field._isInlineRelation) {
      continue;
    }
    const apiFieldName = getApiFieldName(fieldName, field);
    if (!apiFieldName) {
      continue; // Skip excluded fields
    }

    const dbColumnName = field.dbColumn || fieldName;
    
    // Handle type conversions
    if (field.type === "timestamp") {
      // Convert timestamp to ISO string
      mappings.push(`    ${apiFieldName}: entity.${dbColumnName} ? new Date(entity.${dbColumnName}).toISOString() : undefined,`);
    } else if (field.type === "uuid" && apiFieldName !== dbColumnName) {
      mappings.push(`    ${apiFieldName}: entity.${dbColumnName},`);
    } else if (apiFieldName !== dbColumnName) {
      mappings.push(`    ${apiFieldName}: entity.${dbColumnName},`);
    } else {
      mappings.push(`    ${apiFieldName}: entity.${apiFieldName},`);
    }
  }

  const functionName = entityName === apiSchemaName 
    ? `map${entityName}EntityTo${apiSchemaName}`
    : `map${entityName}To${apiSchemaName}`;
    
  return `export function ${functionName}(entity: any): ${apiSchemaName} {
  return {
${mappings.join("\n")}
  };
}`;
}

/**
 * Generate reverse mapper (API schema to entity)
 */
function generateReverseMapper(entityName: string, entityDef: EntityDefinition, availableEntities: Set<string>): string {
  const mappings: string[] = [];
  const apiSchemaName = entityDef.apiSchema || entityName;

  // Find primary field or id field to determine if we should skip it
  let primaryField: [string, EntityField] | undefined;
  let idField: EntityField | undefined;
  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
    if (field.primary) {
      primaryField = [fieldName, field];
    }
    if (fieldName === 'id' && !primaryField) {
      idField = field;
    }
  }
  const shouldSkipId = (primaryField?.[1] || idField) && (primaryField?.[1] || idField)?.type && ((primaryField?.[1] || idField)?.type === 'string' || (primaryField?.[1] || idField)?.type === 'uuid') && !(primaryField?.[1] || idField)?.generated;
  const idFieldName = primaryField ? primaryField[0] : (idField ? 'id' : null);

  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
    // Skip inline relations
    if (field._isInlineRelation) {
      continue;
    }
    const apiFieldName = getApiFieldName(fieldName, field);
    if (!apiFieldName) {
      continue; // Skip excluded fields
    }

    // Skip id/primary fields that should be auto-generated
    if (shouldSkipId && fieldName === idFieldName) {
      continue;
    }

    const dbColumnName = field.dbColumn || fieldName;
    
    // Handle type conversions
    if (field.type === "timestamp") {
      // Convert ISO string to timestamp
      mappings.push(`    ${dbColumnName}: schema.${apiFieldName} ? new Date(schema.${apiFieldName}) : undefined,`);
    } else if (apiFieldName !== dbColumnName) {
      mappings.push(`    ${dbColumnName}: schema.${apiFieldName},`);
    } else if (fieldName === apiFieldName) {
      // Same name, no conversion needed (unless it's a generated field)
      if (!field.generated && !field.primary) {
        mappings.push(`    ${dbColumnName}: schema.${apiFieldName},`);
      }
    }
  }

  const functionName = entityName === apiSchemaName
    ? `map${apiSchemaName}To${entityName}Entity`
    : `map${apiSchemaName}To${entityName}`;
    
  return `export function ${functionName}(schema: ${apiSchemaName}): Partial<any> {
  return {
${mappings.join("\n")}
  };
}`;
}

/**
 * Generate complete mapper file from entities
 */
export function generateMapper(entities: YamaEntities, typesImportPath: string = "../types"): string {
  const header = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

import type { ${Object.entries(entities).map(([name, def]) => def.apiSchema || name).join(", ")} } from "${typesImportPath}";

`;

  const mapperFunctions: string[] = [];
  const availableEntities = new Set(Object.keys(entities));

  for (const [entityName, entityDef] of Object.entries(entities)) {
    mapperFunctions.push(generateEntityMapper(entityName, entityDef, availableEntities));
    mapperFunctions.push(""); // Empty line between mappers
    mapperFunctions.push(generateReverseMapper(entityName, entityDef, availableEntities));
  }

  return header + mapperFunctions.join("\n\n") + "\n";
}

