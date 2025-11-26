import type { YamaEntities, EntityDefinition, EntityField } from "@betagors/yama-core";

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
  if (field.api === false) {
    return null;
  }
  if (field.api && typeof field.api === "string") {
    return field.api;
  }
  if (field.dbColumn) {
    return snakeToCamel(field.dbColumn);
  }
  return fieldName;
}

/**
 * Get database column name from entity field
 */
function getDbColumnName(fieldName: string, field: EntityField): string {
  return field.dbColumn || fieldName;
}

/**
 * Get all queryable fields from entity (exclude generated/primary fields for queries)
 */
function getQueryableFields(entityDef: EntityDefinition): Array<{ fieldName: string; apiFieldName: string; dbColumnName: string; field: EntityField }> {
  const fields: Array<{ fieldName: string; apiFieldName: string; dbColumnName: string; field: EntityField }> = [];
  
  for (const [fieldName, field] of Object.entries(entityDef.fields)) {
    const apiFieldName = getApiFieldName(fieldName, field);
    if (apiFieldName && !field.generated) {
      fields.push({
        fieldName,
        apiFieldName,
        dbColumnName: getDbColumnName(fieldName, field),
        field
      });
    }
  }
  
  return fields;
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Generate explicit query methods for repository
 */
function generateExplicitMethods(
  entityName: string,
  entityDef: EntityDefinition,
  tableName: string,
  apiSchemaName: string,
  mapperFromEntity: string,
  queryableFields: Array<{ fieldName: string; apiFieldName: string; dbColumnName: string; field: EntityField }>,
  primaryFieldName: string,
  primaryDbColumn: string
): string {
  const methods: string[] = [];
  
  // Single field queries
  for (const field of queryableFields) {
    const fieldType = field.field.type === 'boolean' ? 'boolean' : 
                     field.field.type === 'number' || field.field.type === 'integer' ? 'number' : 'string';
    const fieldCapitalized = capitalize(field.apiFieldName);
    const dbColumn = field.dbColumnName;
    
    // findBy{Field}
    methods.push(`  /**
   * Find ${apiSchemaName} by ${field.apiFieldName}
   */
  async findBy${fieldCapitalized}(value: ${fieldType}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(eq(${tableName}.${dbColumn}, value));
    return entities.map(${mapperFromEntity});
  }`);
    
    // findBy{Field}Equals
    methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} equals value
   */
  async findBy${fieldCapitalized}Equals(value: ${fieldType}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(eq(${tableName}.${dbColumn}, value));
    return entities.map(${mapperFromEntity});
  }`);
    
    // Boolean operations
    if (field.field.type === 'boolean') {
      methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} is true
   */
  async findBy${fieldCapitalized}IsTrue(): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(eq(${tableName}.${dbColumn}, true));
    return entities.map(${mapperFromEntity});
  }`);
      
      methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} is false
   */
  async findBy${fieldCapitalized}IsFalse(): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(eq(${tableName}.${dbColumn}, false));
    return entities.map(${mapperFromEntity});
  }`);
    }
    
    // String operations
    if (field.field.type === 'string' || field.field.type === 'text') {
      methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} contains value
   */
  async findBy${fieldCapitalized}Contains(value: string): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(ilike(${tableName}.${dbColumn}, \`%\${value}%\`));
    return entities.map(${mapperFromEntity});
  }`);
      
      methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} starts with value
   */
  async findBy${fieldCapitalized}StartsWith(value: string): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(ilike(${tableName}.${dbColumn}, \`\${value}%\`));
    return entities.map(${mapperFromEntity});
  }`);
      
      methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} ends with value
   */
  async findBy${fieldCapitalized}EndsWith(value: string): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(ilike(${tableName}.${dbColumn}, \`%\${value}\`));
    return entities.map(${mapperFromEntity});
  }`);
    }
    
    // Date/number comparisons
    if (field.field.type === 'timestamp' || field.field.type === 'number' || field.field.type === 'integer') {
      const dateType = field.field.type === 'timestamp' ? 'string' : 'number';
      methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} is after value
   */
  async findBy${fieldCapitalized}After(value: ${dateType}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(gt(${tableName}.${dbColumn}, value));
    return entities.map(${mapperFromEntity});
  }`);
      
      methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} is before value
   */
  async findBy${fieldCapitalized}Before(value: ${dateType}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(lt(${tableName}.${dbColumn}, value));
    return entities.map(${mapperFromEntity});
  }`);
    }
    
    // findByIdAnd{Field}
    if (field.apiFieldName.toLowerCase() !== primaryFieldName.toLowerCase()) {
      methods.push(`  /**
   * Find ${apiSchemaName} by ID and ${field.apiFieldName}
   */
  async findByIdAnd${fieldCapitalized}(id: string, value: ${fieldType}): Promise<${apiSchemaName} | null> {
    const db = getDb();
    const [entity] = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${primaryDbColumn}, id), eq(${tableName}.${dbColumn}, value)))
      .limit(1);
    if (!entity) return null;
    return ${mapperFromEntity}(entity);
  }`);
      
      if (field.field.type === 'boolean') {
        methods.push(`  /**
   * Find ${apiSchemaName} by ID where ${field.apiFieldName} is true
   */
  async findByIdAnd${fieldCapitalized}IsTrue(id: string): Promise<${apiSchemaName} | null> {
    const db = getDb();
    const [entity] = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${primaryDbColumn}, id), eq(${tableName}.${dbColumn}, true)))
      .limit(1);
    if (!entity) return null;
    return ${mapperFromEntity}(entity);
  }`);
        
        methods.push(`  /**
   * Find ${apiSchemaName} by ID where ${field.apiFieldName} is false
   */
  async findByIdAnd${fieldCapitalized}IsFalse(id: string): Promise<${apiSchemaName} | null> {
    const db = getDb();
    const [entity] = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${primaryDbColumn}, id), eq(${tableName}.${dbColumn}, false)))
      .limit(1);
    if (!entity) return null;
    return ${mapperFromEntity}(entity);
  }`);
      }
    }
  }
  
  // Two field combinations (limit to avoid explosion)
  for (let i = 0; i < queryableFields.length && i < 5; i++) {
    for (let j = i + 1; j < queryableFields.length && j < 5; j++) {
      const field1 = queryableFields[i];
      const field2 = queryableFields[j];
      const type1 = field1.field.type === 'boolean' ? 'boolean' : 
                   field1.field.type === 'number' || field1.field.type === 'integer' ? 'number' : 'string';
      const type2 = field2.field.type === 'boolean' ? 'boolean' : 
                   field2.field.type === 'number' || field2.field.type === 'integer' ? 'number' : 'string';
      const field1Capitalized = capitalize(field1.apiFieldName);
      const field2Capitalized = capitalize(field2.apiFieldName);
      
      methods.push(`  /**
   * Find ${apiSchemaName} by ${field1.apiFieldName} and ${field2.apiFieldName}
   */
  async findBy${field1Capitalized}And${field2Capitalized}(value1: ${type1}, value2: ${type2}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${field1.dbColumnName}, value1), eq(${tableName}.${field2.dbColumnName}, value2)));
    return entities.map(${mapperFromEntity});
  }`);
      
      if (field2.field.type === 'boolean') {
        methods.push(`  /**
   * Find ${apiSchemaName} by ${field1.apiFieldName} where ${field2.apiFieldName} is true
   */
  async findBy${field1Capitalized}And${field2Capitalized}IsTrue(value1: ${type1}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${field1.dbColumnName}, value1), eq(${tableName}.${field2.dbColumnName}, true)));
    return entities.map(${mapperFromEntity});
  }`);
        
        methods.push(`  /**
   * Find ${apiSchemaName} by ${field1.apiFieldName} where ${field2.apiFieldName} is false
   */
  async findBy${field1Capitalized}And${field2Capitalized}IsFalse(value1: ${type1}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${field1.dbColumnName}, value1), eq(${tableName}.${field2.dbColumnName}, false)));
    return entities.map(${mapperFromEntity});
  }`);
      }
    }
  }
  
  // OrderBy variants
  for (const field of queryableFields.slice(0, 5)) {
    const fieldCapitalized = capitalize(field.apiFieldName);
    methods.push(`  /**
   * Find all ${apiSchemaName} ordered by ${field.apiFieldName} ascending
   */
  async findAllOrderBy${fieldCapitalized}Asc(): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .orderBy(asc(${tableName}.${field.dbColumnName}));
    return entities.map(${mapperFromEntity});
  }`);
    
    methods.push(`  /**
   * Find all ${apiSchemaName} ordered by ${field.apiFieldName} descending
   */
  async findAllOrderBy${fieldCapitalized}Desc(): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const entities = await db.select()
      .from(${tableName})
      .orderBy(desc(${tableName}.${field.dbColumnName}));
    return entities.map(${mapperFromEntity});
  }`);
  }
  
  return methods.join('\n\n');
}

/**
 * Generate repository class for a single entity
 */
function generateRepositoryClass(
  entityName: string,
  entityDef: EntityDefinition,
  typesImportPath: string
): string {
  const tableName = entityName.toLowerCase();
  const apiSchemaName = entityDef.apiSchema || entityName;
  const createInputName = `Create${apiSchemaName}Input`;
  const updateInputName = `Update${apiSchemaName}Input`;
  
  const mapperToEntity = `map${apiSchemaName}To${entityName}Entity`;
  const mapperFromEntity = `map${entityName}EntityTo${apiSchemaName}`;
  
  const queryableFields = getQueryableFields(entityDef);
  const primaryField = Object.entries(entityDef.fields).find(([, f]) => f.primary);
  const primaryFieldName = primaryField ? primaryField[0] : 'id';
  const primaryDbColumn = primaryField ? getDbColumnName(primaryField[0], primaryField[1]) : 'id';
  
  // Check if we should generate ID: field exists and is string/uuid type
  const idField = primaryField ? primaryField[1] : entityDef.fields['id'];
  const shouldGenerateId = idField && typeof idField === 'object' && !Array.isArray(idField) && (idField.type === 'string' || idField.type === 'uuid') && !idField.generated;
  
  const explicitMethods = generateExplicitMethods(
    entityName,
    entityDef,
    tableName,
    apiSchemaName,
    mapperFromEntity,
    queryableFields,
    primaryFieldName,
    primaryDbColumn
  );
  
  const idGenerationCode = shouldGenerateId 
    ? `    // Generate ID if not provided
    if (!entityData.${primaryDbColumn} || entityData.${primaryDbColumn} === undefined) {
      entityData.${primaryDbColumn} = randomUUID();
    }`
    : '';
  
  return `import { postgresqlAdapter } from "@betagors/yama-postgres";
import { ${tableName} } from "./schema.ts";
import { ${mapperToEntity}, ${mapperFromEntity} } from "./mapper.ts";
import { eq, and, or, ilike, gt, lt, desc, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { ${apiSchemaName}, ${createInputName}, ${updateInputName} } from "${typesImportPath}";
import type { ${entityName}RepositoryMethods } from "./repository-types.ts";
import type { ReturnType } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/postgres-js";
import { randomUUID } from "crypto";

type Database = ReturnType<typeof drizzle>;

function getDb(): Database {
  try {
    return postgresqlAdapter.getClient() as Database;
  } catch (error) {
    throw new Error("Database not initialized - ensure database is configured in yama.yaml");
  }
}

export class ${entityName}Repository {
  /**
   * Create a new ${apiSchemaName}
   */
  async create(input: ${createInputName}): Promise<${apiSchemaName}> {
    const db = getDb();
    const entityData = ${mapperToEntity}(input);
${idGenerationCode}
    const [entity] = await db.insert(${tableName}).values(entityData).returning();
    return ${mapperFromEntity}(entity);
  }

  /**
   * Find ${apiSchemaName} by ID
   */
  async findById(id: string): Promise<${apiSchemaName} | null> {
    const db = getDb();
    const [entity] = await db.select().from(${tableName}).where(eq(${tableName}.${primaryDbColumn}, id)).limit(1);
    if (!entity) return null;
    return ${mapperFromEntity}(entity);
  }

  /**
   * Find all ${apiSchemaName} records
   */
  async findAll(options?: {
${queryableFields.map(f => {
  const tsType = f.field.type === 'boolean' ? 'boolean' : 
                f.field.type === 'number' || f.field.type === 'integer' ? 'number' : 'string';
  return `    ${f.apiFieldName}?: ${tsType};`;
}).join('\n')}
    limit?: number;
    offset?: number;
    orderBy?: { field: string; direction?: 'asc' | 'desc' };
    search?: string;
    searchFields?: string[];
    searchMode?: 'contains' | 'starts' | 'ends' | 'exact';
  }): Promise<${apiSchemaName}[]> {
    const db = getDb();
    let query = db.select().from(${tableName});
    
    const conditions: SQL[] = [];
${queryableFields.map(f => {
  const dbCol = f.dbColumnName;
  return `    if (options?.${f.apiFieldName} !== undefined) {
      conditions.push(eq(${tableName}.${dbCol}, options.${f.apiFieldName}));
    }`;
}).join('\n')}
    
    // Handle search
    if (options?.search) {
      const searchTerm = String(options.search);
      const searchFields = options.searchFields || [${queryableFields.filter(f => f.field.type === 'string' || f.field.type === 'text').map(f => `'${f.apiFieldName}'`).join(', ')}];
      const searchMode = options.searchMode || 'contains';
      
      const searchConditions: SQL[] = [];
      for (const fieldName of searchFields) {
        const searchableField = queryableFields.find(f => f.apiFieldName === fieldName);
        if (searchableField && (searchableField.field.type === 'string' || searchableField.field.type === 'text')) {
          const dbCol = searchableField.dbColumnName;
          if (searchMode === 'contains') {
            searchConditions.push(ilike(${tableName}.${dbCol}, \`%\${searchTerm}%\`));
          } else if (searchMode === 'starts') {
            searchConditions.push(ilike(${tableName}.${dbCol}, \`\${searchTerm}%\`));
          } else if (searchMode === 'ends') {
            searchConditions.push(ilike(${tableName}.${dbCol}, \`%\${searchTerm}\`));
          } else if (searchMode === 'exact') {
            searchConditions.push(eq(${tableName}.${dbCol}, searchTerm));
          }
        }
      }
      
      if (searchConditions.length > 0) {
        // Use OR for full-text search across multiple fields
        conditions.push(or(...searchConditions));
      }
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    if (options?.orderBy) {
      const orderField = ${tableName}[options.orderBy.field] || ${tableName}.${primaryDbColumn};
      if (orderField) {
        query = query.orderBy(options.orderBy.direction === 'desc' ? desc(orderField) : asc(orderField));
      }
    }
    
    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }
    
    if (options?.offset !== undefined) {
      query = query.offset(options.offset);
    }
    
    const entities = await query;
    return entities.map(${mapperFromEntity});
  }

  /**
   * Update ${apiSchemaName} by ID
   */
  async update(id: string, input: ${updateInputName}): Promise<${apiSchemaName} | null> {
    const db = getDb();
    const entityData = ${mapperToEntity}(input);
    const [entity] = await db.update(${tableName})
      .set(entityData)
      .where(eq(${tableName}.${primaryDbColumn}, id))
      .returning();
    
    if (!entity) return null;
    return ${mapperFromEntity}(entity);
  }

  /**
   * Delete ${apiSchemaName} by ID
   */
  async delete(id: string): Promise<boolean> {
    const db = getDb();
    const result = await db.delete(${tableName}).where(eq(${tableName}.${primaryDbColumn}, id)).returning();
    return result.length > 0;
  }

${explicitMethods}
}

export const ${entityName.toLowerCase()}Repository: ${entityName}RepositoryMethods = new ${entityName}Repository();
`;
}

/**
 * Generate type definitions for repository methods
 */
function generateRepositoryTypes(
  entityName: string,
  entityDef: EntityDefinition,
  typesImportPath: string
): string {
  const apiSchemaName = entityDef.apiSchema || entityName;
  const createInputName = `Create${apiSchemaName}Input`;
  const updateInputName = `Update${apiSchemaName}Input`;
  
  const queryableFields = getQueryableFields(entityDef);
  const primaryField = Object.entries(entityDef.fields).find(([, f]) => f.primary);
  const primaryFieldName = primaryField ? getApiFieldName(primaryField[0], primaryField[1]) || primaryField[0] : 'id';
  
  // Generate method signatures for common patterns
  const methodSignatures: string[] = [];
  
  // Standard CRUD
  methodSignatures.push(`  create(input: ${createInputName}): Promise<${apiSchemaName}>;`);
  methodSignatures.push(`  findById(id: string): Promise<${apiSchemaName} | null>;`);
  methodSignatures.push(`  findAll(options?: FindAllOptions): Promise<${apiSchemaName}[]>;`);
  methodSignatures.push(`  update(id: string, input: ${updateInputName}): Promise<${apiSchemaName} | null>;`);
  methodSignatures.push(`  delete(id: string): Promise<boolean>;`);
  methodSignatures.push('');
  
  // Generate dynamic method signatures
  // Single field queries
  for (const field of queryableFields) {
    const fieldType = field.field.type === 'boolean' ? 'boolean' : 
                     field.field.type === 'number' || field.field.type === 'integer' ? 'number' : 'string';
    
    // findBy{Field}
    methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}(value: ${fieldType}): Promise<${apiSchemaName}[]>;`);
    
    // findBy{Field}IsTrue/IsFalse (for booleans)
    if (field.field.type === 'boolean') {
      methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}IsTrue(): Promise<${apiSchemaName}[]>;`);
      methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}IsFalse(): Promise<${apiSchemaName}[]>;`);
    }
    
    // findBy{Field}Equals
    methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}Equals(value: ${fieldType}): Promise<${apiSchemaName}[]>;`);
    
    // String operations
    if (field.field.type === 'string' || field.field.type === 'text') {
      methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}Contains(value: string): Promise<${apiSchemaName}[]>;`);
      methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}StartsWith(value: string): Promise<${apiSchemaName}[]>;`);
      methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}EndsWith(value: string): Promise<${apiSchemaName}[]>;`);
    }
    
    // Date/number comparisons
    if (field.field.type === 'timestamp' || field.field.type === 'number' || field.field.type === 'integer') {
      const dateType = field.field.type === 'timestamp' ? 'string' : 'number';
      methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}After(value: ${dateType}): Promise<${apiSchemaName}[]>;`);
      methodSignatures.push(`  findBy${capitalize(field.apiFieldName)}Before(value: ${dateType}): Promise<${apiSchemaName}[]>;`);
    }
    
    // findByIdAnd{Field}
    if (field.apiFieldName.toLowerCase() !== primaryFieldName.toLowerCase()) {
      methodSignatures.push(`  findByIdAnd${capitalize(field.apiFieldName)}(id: string, value: ${fieldType}): Promise<${apiSchemaName} | null>;`);
      
      if (field.field.type === 'boolean') {
        methodSignatures.push(`  findByIdAnd${capitalize(field.apiFieldName)}IsTrue(id: string): Promise<${apiSchemaName} | null>;`);
        methodSignatures.push(`  findByIdAnd${capitalize(field.apiFieldName)}IsFalse(id: string): Promise<${apiSchemaName} | null>;`);
      }
    }
  }
  
  // Two field combinations (limit to avoid explosion)
  for (let i = 0; i < queryableFields.length && i < 5; i++) {
    for (let j = i + 1; j < queryableFields.length && j < 5; j++) {
      const field1 = queryableFields[i];
      const field2 = queryableFields[j];
      const type1 = field1.field.type === 'boolean' ? 'boolean' : 
                   field1.field.type === 'number' || field1.field.type === 'integer' ? 'number' : 'string';
      const type2 = field2.field.type === 'boolean' ? 'boolean' : 
                   field2.field.type === 'number' || field2.field.type === 'integer' ? 'number' : 'string';
      
      methodSignatures.push(`  findBy${capitalize(field1.apiFieldName)}And${capitalize(field2.apiFieldName)}(value1: ${type1}, value2: ${type2}): Promise<${apiSchemaName}[]>;`);
      
      if (field2.field.type === 'boolean') {
        methodSignatures.push(`  findBy${capitalize(field1.apiFieldName)}And${capitalize(field2.apiFieldName)}IsTrue(value1: ${type1}): Promise<${apiSchemaName}[]>;`);
        methodSignatures.push(`  findBy${capitalize(field1.apiFieldName)}And${capitalize(field2.apiFieldName)}IsFalse(value1: ${type1}): Promise<${apiSchemaName}[]>;`);
      }
    }
  }
  
  // OrderBy variants
  for (const field of queryableFields.slice(0, 5)) {
    methodSignatures.push(`  findAllOrderBy${capitalize(field.apiFieldName)}Asc(): Promise<${apiSchemaName}[]>;`);
    methodSignatures.push(`  findAllOrderBy${capitalize(field.apiFieldName)}Desc(): Promise<${apiSchemaName}[]>;`);
  }
  
  return `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

import type { ${apiSchemaName}, ${createInputName}, ${updateInputName} } from "${typesImportPath}";

export interface FindAllOptions {
${queryableFields.map(f => {
  const tsType = f.field.type === 'boolean' ? 'boolean' : 
                f.field.type === 'number' || f.field.type === 'integer' ? 'number' : 'string';
  return `  ${f.apiFieldName}?: ${tsType};`;
}).join('\n')}
  limit?: number;
  offset?: number;
  orderBy?: { field: string; direction?: 'asc' | 'desc' };
  search?: string;
  searchFields?: string[];
  searchMode?: 'contains' | 'starts' | 'ends' | 'exact';
}

export interface ${entityName}RepositoryMethods {
${methodSignatures.join('\n')}
}

export type ${entityName}RepositoryType = ${entityName}RepositoryMethods;
`;
}

/**
 * Generate complete repository file from entities
 */
export function generateRepository(
  entities: YamaEntities,
  typesImportPath: string = "../types"
): { repository: string; types: string } {
  const repositoryClasses: string[] = [];
  const typeDefinitions: string[] = [];
  
  for (const [entityName, entityDef] of Object.entries(entities)) {
    repositoryClasses.push(generateRepositoryClass(entityName, entityDef, typesImportPath));
    typeDefinitions.push(generateRepositoryTypes(entityName, entityDef, typesImportPath));
  }
  
  return {
    repository: `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

${repositoryClasses.join('\n\n')}
`,
    types: typeDefinitions.join('\n\n')
  };
}
