import type { YamaEntities, EntityDefinition, EntityField } from "@betagors/yama-core";
import { parseFieldDefinition } from "@betagors/yama-core";

/**
 * Generate Drizzle table definition for a single entity
 */
function generateDrizzleTable(entityName: string, entityDef: EntityDefinition, entities: YamaEntities, allImports: Set<string>): string {
  const columns: string[] = [];
  const indexes: string[] = [];

  // Process each field
  const availableEntities = new Set(Object.keys(entities));
  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
    // Skip inline relations (they generate foreign keys separately)
    if (field._isInlineRelation) {
      continue;
    }
    const dbColumnName = field.dbColumn || fieldName;
    const columnDef = generateDrizzleColumn(fieldName, field, dbColumnName);
    if (columnDef) {
      columns.push(`  ${columnDef}`);
    }
  }

  // Process indexes
  if (entityDef.indexes) {
    for (const index of entityDef.indexes) {
      // Normalize index format - can be string, array, or object
      let normalizedIndex: { fields: string[]; name?: string; unique?: boolean };
      if (typeof index === 'string') {
        // Single field: "published"
        normalizedIndex = { fields: [index] };
      } else if (Array.isArray(index)) {
        // Array of fields: [authorId, publishedAt]
        normalizedIndex = { fields: index };
      } else {
        // Object format: { fields: [...], name: "...", unique: true }
        normalizedIndex = index;
      }
      
      const indexDef = generateDrizzleIndex(entityName.toLowerCase(), entityDef.table || entityName.toLowerCase(), normalizedIndex);
      if (indexDef) {
        indexes.push(indexDef);
      }
    }
  }

  // Also add indexes for fields with index: true
  const availableEntitiesForIndex = new Set(Object.keys(entities));
  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef, availableEntitiesForIndex);
    if (field.index) {
      const dbColumnName = field.dbColumn || fieldName;
      indexes.push(
        `export const ${entityName.toLowerCase()}_${fieldName}_idx = index(\`${entityDef.table}_${dbColumnName}_idx\`).on(${entityName.toLowerCase()}.${dbColumnName});`
      );
    }
  }

  const tableDef = `export const ${entityName.toLowerCase()} = pgTable(\`${entityDef.table}\`, {
${columns.join(",\n")}
});`;

  const indexExports = indexes.length > 0 ? `\n\n${indexes.join("\n")}` : "";

  return `${tableDef}${indexExports}`;
}

/**
 * Generate Drizzle column definition
 */
function generateDrizzleColumn(
  fieldName: string,
  field: EntityField,
  dbColumnName: string
): string | null {
  let columnType: string;
  let columnModifiers: string[] = [];

  // Determine column type
  const dbType = field.dbType;
  
  switch (field.type) {
    case "uuid":
      if (field.generated) {
        columnType = `uuid(\`${dbColumnName}\`).defaultRandom()`;
      } else {
        columnType = `uuid(\`${dbColumnName}\`)`;
      }
      break;
    
    case "string":
      if (dbType) {
        // Use explicit dbType if provided
        const match = dbType.match(/varchar\((\d+)\)/);
        if (match) {
          columnType = `varchar(\`${dbColumnName}\`, { length: ${match[1]} })`;
        } else {
          columnType = `varchar(\`${dbColumnName}\`)`;
        }
      } else if (field.maxLength) {
        columnType = `varchar(\`${dbColumnName}\`, { length: ${field.maxLength} })`;
      } else {
        columnType = `varchar(\`${dbColumnName}\`)`;
      }
      break;
    
    case "text":
      columnType = `text(\`${dbColumnName}\`)`;
      break;
    
    case "number":
    case "integer":
      columnType = `integer(\`${dbColumnName}\`)`;
      break;
    
    case "boolean":
      columnType = `boolean(\`${dbColumnName}\`)`;
      break;
    
    case "timestamp":
      if (field.default === "now()" || field.default === "now") {
        columnType = `timestamp(\`${dbColumnName}\`).defaultNow()`;
      } else if (field.default) {
        columnType = `timestamp(\`${dbColumnName}\`).default(${JSON.stringify(field.default)})`;
      } else {
        columnType = `timestamp(\`${dbColumnName}\`)`;
      }
      break;
    
    case "jsonb":
      columnType = `jsonb(\`${dbColumnName}\`)`;
      break;
    
    default:
      return null;
  }

  // Add primary key
  if (field.primary) {
    columnModifiers.push(".primaryKey()");
  }

  // Add nullable/notNull
  if (field.nullable === false || field.required) {
    columnModifiers.push(".notNull()");
  } else if (field.nullable === true) {
    // nullable is default in Drizzle, but we can be explicit
  }

  // Add default (if not already in type)
  if (field.default !== undefined && field.type !== "timestamp") {
    if (typeof field.default === "string" && field.default !== "now()" && field.default !== "now") {
      columnModifiers.push(`.default(${JSON.stringify(field.default)})`);
    } else if (typeof field.default === "number" || typeof field.default === "boolean") {
      columnModifiers.push(`.default(${field.default})`);
    }
  }

  return `${fieldName}: ${columnType}${columnModifiers.join("")}`;
}

/**
 * Generate Drizzle index definition
 */
function generateDrizzleIndex(tableVarName: string, tableName: string, index: { fields: string[]; name?: string; unique?: boolean }): string {
  const indexName = index.name || `${tableName}_${index.fields.join("_")}_idx`;
  const fieldsRef = index.fields.map(f => `${tableVarName}.${f}`).join(", ");
  const uniqueModifier = index.unique ? ".unique()" : "";
  
  return `export const ${indexName} = index(\`${indexName}\`).on(${fieldsRef})${uniqueModifier};`;
}

/**
 * Generate complete Drizzle schema file from entities
 */
export function generateDrizzleSchema(entities: YamaEntities): string {
  const header = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

`;

  // Collect all unique imports
  const allImports = new Set<string>(["pgTable", "index"]);
  const availableEntitiesForImports = new Set(Object.keys(entities));
  for (const [, entityDef] of Object.entries(entities)) {
    for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
      const field = parseFieldDefinition(fieldName, fieldDef, availableEntitiesForImports);
      // Skip inline relations
      if (field._isInlineRelation) {
        continue;
      }
      switch (field.type) {
        case "uuid":
          allImports.add("uuid");
          break;
        case "string":
        case "text":
          allImports.add("varchar");
          allImports.add("text");
          break;
        case "number":
        case "integer":
          allImports.add("integer");
          break;
        case "boolean":
          allImports.add("boolean");
          break;
        case "timestamp":
          allImports.add("timestamp");
          break;
        case "jsonb":
          allImports.add("jsonb");
          break;
      }
    }
  }

  const importStatement = `import { ${Array.from(allImports).sort().join(", ")} } from "drizzle-orm/pg-core";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";\n\n`;

  const tableDefinitions: string[] = [];
  const typeExports: string[] = [];

  for (const [entityName, entityDef] of Object.entries(entities)) {
    const tableCode = generateDrizzleTable(entityName, entityDef, entities, allImports);
    tableDefinitions.push(tableCode);
    
    const tableName = entityName.toLowerCase();
    typeExports.push(`export type ${entityName}Entity = InferSelectModel<typeof ${tableName}>;`);
    typeExports.push(`export type New${entityName}Entity = InferInsertModel<typeof ${tableName}>;`);
  }

  const typeExportsSection = typeExports.length > 0 ? `\n\n${typeExports.join("\n")}\n` : "";

  return header + importStatement + tableDefinitions.join("\n\n") + typeExportsSection;
}

