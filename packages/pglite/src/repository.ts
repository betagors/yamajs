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
function getQueryableFields(entityDef: EntityDefinition, availableEntities: Set<string>): Array<{ fieldName: string; apiFieldName: string; dbColumnName: string; field: EntityField }> {
  const fields: Array<{ fieldName: string; apiFieldName: string; dbColumnName: string; field: EntityField }> = [];
  
  if (!entityDef.fields) {
    return fields;
  }
  
  for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
    const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
    // Skip inline relations
    if (field._isInlineRelation) {
      continue;
    }
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
    // Skip primary field - it already has findById method
    if (field.fieldName === primaryFieldName) {
      continue;
    }
    
    const fieldType = field.field.type === 'boolean' ? 'boolean' : 
                     field.field.type === 'number' || field.field.type === 'integer' ? 'number' :
                     field.field.type === 'timestamp' || field.field.type === 'date' ? 'Date | string' : 'string';
    const fieldCapitalized = capitalize(field.apiFieldName);
    const dbColumn = field.dbColumnName;
    const isTimestamp = field.field.type === 'timestamp' || field.field.type === 'date';
    const dateConversion = isTimestamp ? `    const dateValue = typeof value === 'string' ? new Date(value) : value;` : '';
    const valueVar = isTimestamp ? 'dateValue' : 'value';
    
    // findBy{Field}
    methods.push(`  /**
   * Find ${apiSchemaName} by ${field.apiFieldName}
   */
  async findBy${fieldCapitalized}(value: ${fieldType}): Promise<${apiSchemaName}[]> {
    const db = getDb();
${dateConversion}
    const entities = await db.select()
      .from(${tableName})
      .where(eq(${tableName}.${dbColumn}, ${valueVar}));
    return entities.map(${mapperFromEntity});
  }`);
    
    // findBy{Field}Equals
    methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} equals value
   */
  async findBy${fieldCapitalized}Equals(value: ${fieldType}): Promise<${apiSchemaName}[]> {
    const db = getDb();
${dateConversion}
    const entities = await db.select()
      .from(${tableName})
      .where(eq(${tableName}.${dbColumn}, ${valueVar}));
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
      const dateType = field.field.type === 'timestamp' ? 'Date | string' : 'number';
      if (field.field.type === 'timestamp') {
        methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} is after value
   */
  async findBy${fieldCapitalized}After(value: ${dateType}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const dateValue = typeof value === 'string' ? new Date(value) : value;
    const entities = await db.select()
      .from(${tableName})
      .where(gt(${tableName}.${dbColumn}, dateValue));
    return entities.map(${mapperFromEntity});
  }`);
        
        methods.push(`  /**
   * Find ${apiSchemaName} where ${field.apiFieldName} is before value
   */
  async findBy${fieldCapitalized}Before(value: ${dateType}): Promise<${apiSchemaName}[]> {
    const db = getDb();
    const dateValue = typeof value === 'string' ? new Date(value) : value;
    const entities = await db.select()
      .from(${tableName})
      .where(lt(${tableName}.${dbColumn}, dateValue));
    return entities.map(${mapperFromEntity});
  }`);
      } else {
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
    }
    
    // findByIdAnd{Field}
    if (field.fieldName !== primaryFieldName && field.apiFieldName.toLowerCase() !== primaryFieldName.toLowerCase()) {
      // Handle timestamp fields specially
      if (field.field.type === 'timestamp' || field.field.type === 'date') {
        methods.push(`  /**
   * Find ${apiSchemaName} by ID and ${field.apiFieldName}
   */
  async findByIdAnd${fieldCapitalized}(id: string, value: Date | string): Promise<${apiSchemaName} | null> {
    const db = getDb();
    const dateValue = typeof value === 'string' ? new Date(value) : value;
    const [entity] = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${primaryDbColumn}, id), eq(${tableName}.${dbColumn}, dateValue)))
      .limit(1);
    if (!entity) return null;
    return ${mapperFromEntity}(entity);
  }`);
      } else {
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
      }
      
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
      
      // Skip if field1 is the primary key to avoid duplicate with findByIdAnd{Field}
      if (field1.fieldName === primaryFieldName) {
        continue;
      }
      
      const type1 = field1.field.type === 'boolean' ? 'boolean' : 
                   field1.field.type === 'number' || field1.field.type === 'integer' ? 'number' : 
                   field1.field.type === 'timestamp' || field1.field.type === 'date' ? 'Date | string' : 'string';
      const type2 = field2.field.type === 'boolean' ? 'boolean' : 
                   field2.field.type === 'number' || field2.field.type === 'integer' ? 'number' : 
                   field2.field.type === 'timestamp' || field2.field.type === 'date' ? 'Date | string' : 'string';
      const field1Capitalized = capitalize(field1.apiFieldName);
      const field2Capitalized = capitalize(field2.apiFieldName);
      
      // Handle timestamp conversions
      const needsTimestampConversion1 = field1.field.type === 'timestamp' || field1.field.type === 'date';
      const needsTimestampConversion2 = field2.field.type === 'timestamp' || field2.field.type === 'date';
      const conversionCode1 = needsTimestampConversion1 ? `    const value1Converted = typeof value1 === 'string' ? new Date(value1) : value1;` : '';
      const conversionCode2 = needsTimestampConversion2 ? `    const value2Converted = typeof value2 === 'string' ? new Date(value2) : value2;` : '';
      const value1Var = needsTimestampConversion1 ? 'value1Converted' : 'value1';
      const value2Var = needsTimestampConversion2 ? 'value2Converted' : 'value2';
      
      methods.push(`  /**
   * Find ${apiSchemaName} by ${field1.apiFieldName} and ${field2.apiFieldName}
   */
  async findBy${field1Capitalized}And${field2Capitalized}(value1: ${type1}, value2: ${type2}): Promise<${apiSchemaName}[]> {
    const db = getDb();
${conversionCode1}${conversionCode2}
    const entities = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${field1.dbColumnName}, ${value1Var}), eq(${tableName}.${field2.dbColumnName}, ${value2Var})));
    return entities.map(${mapperFromEntity});
  }`);
      
      if (field2.field.type === 'boolean') {
        const conversionCode1 = needsTimestampConversion1 ? `    const value1Converted = typeof value1 === 'string' ? new Date(value1) : value1;` : '';
        const value1Var = needsTimestampConversion1 ? 'value1Converted' : 'value1';
        
        methods.push(`  /**
   * Find ${apiSchemaName} by ${field1.apiFieldName} where ${field2.apiFieldName} is true
   */
  async findBy${field1Capitalized}And${field2Capitalized}IsTrue(value1: ${type1}): Promise<${apiSchemaName}[]> {
    const db = getDb();
${conversionCode1}
    const entities = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${field1.dbColumnName}, ${value1Var}), eq(${tableName}.${field2.dbColumnName}, true)));
    return entities.map(${mapperFromEntity});
  }`);
        
        methods.push(`  /**
   * Find ${apiSchemaName} by ${field1.apiFieldName} where ${field2.apiFieldName} is false
   */
  async findBy${field1Capitalized}And${field2Capitalized}IsFalse(value1: ${type1}): Promise<${apiSchemaName}[]> {
    const db = getDb();
${conversionCode1}
    const entities = await db.select()
      .from(${tableName})
      .where(and(eq(${tableName}.${field1.dbColumnName}, ${value1Var}), eq(${tableName}.${field2.dbColumnName}, false)));
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
 * Generate repository class for a single entity (class body only, no imports)
 */
function generateRepositoryClass(
  entityName: string,
  entityDef: EntityDefinition,
  typesImportPath: string,
  availableEntities: Set<string>
): { classCode: string; schemaImport: string; mapperImports: string; typeImports: string; repositoryTypeImport: string } {
  const tableName = entityName.toLowerCase();
  const apiSchemaName = entityDef.apiSchema || entityName;
  // Use base type for inputs (Create/Update types may not be generated)
  const createInputName = apiSchemaName;
  const updateInputName = `Partial<${apiSchemaName}>`;
  
  const mapperToEntity = `map${apiSchemaName}To${entityName}Entity`;
  const mapperFromEntity = `map${entityName}EntityTo${apiSchemaName}`;
  
  const queryableFields = getQueryableFields(entityDef, availableEntities);
  
  // Find primary field
  let primaryField: [string, EntityField] | undefined;
  if (entityDef.fields) {
    for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
      const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
      if (field.primary) {
        primaryField = [fieldName, field];
        break;
      }
    }
  }
  const primaryFieldName = primaryField ? primaryField[0] : 'id';
  const primaryDbColumn = primaryField ? getDbColumnName(primaryField[0], primaryField[1]) : 'id';
  
  // Check if we should generate ID: field exists and is string/uuid type
  const idFieldDef = entityDef.fields?.['id'];
  const idField = idFieldDef ? parseFieldDefinition('id', idFieldDef, availableEntities) : (primaryField ? primaryField[1] : undefined);
  const shouldGenerateId = idField && (idField.type === 'string' || idField.type === 'uuid') && !idField.generated;
  
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
  
  const classCode = `export class ${entityName}Repository {
  /**
   * Create a new ${apiSchemaName}
   */
  async create(input: ${createInputName}): Promise<${apiSchemaName}> {
    const db = getDb();
    const entityData = ${mapperToEntity}(input) as any;
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
  let tsType: string;
  if (f.field.type === 'boolean') {
    tsType = 'boolean';
  } else if (f.field.type === 'number' || f.field.type === 'integer') {
    tsType = 'number';
  } else if (f.field.type === 'timestamp' || f.field.type === 'date') {
    tsType = 'Date | string';
  } else {
    tsType = 'string';
  }
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
  if (f.field.type === 'timestamp' || f.field.type === 'date') {
    return `    if (options?.${f.apiFieldName} !== undefined) {
      const ${f.apiFieldName}Value = typeof options.${f.apiFieldName} === 'string' ? new Date(options.${f.apiFieldName}) : options.${f.apiFieldName};
      conditions.push(eq(${tableName}.${f.dbColumnName}, ${f.apiFieldName}Value));
    }`;
  } else {
    return `    if (options?.${f.apiFieldName} !== undefined) {
      conditions.push(eq(${tableName}.${f.dbColumnName}, options.${f.apiFieldName}));
    }`;
  }
}).join('\n')}
    
    // Handle search
    if (options?.search) {
      const searchTerm = String(options.search);
      const defaultSearchFields = [${queryableFields.filter(f => f.field.type === 'string' || f.field.type === 'text').map(f => `'${f.apiFieldName}'`).join(', ')}];
      const searchFields = options.searchFields || defaultSearchFields;
      const searchMode = options.searchMode || 'contains';
      
      // Map of searchable fields to their db columns
      const fieldToDbColumn: Record<string, any> = {
${queryableFields.filter(f => f.field.type === 'string' || f.field.type === 'text').map(f => `        '${f.apiFieldName}': ${tableName}.${f.dbColumnName}`).join(',\n')}
      };
      
      const searchConditions: SQL[] = [];
      for (const fieldName of searchFields) {
        const dbColumn = fieldToDbColumn[fieldName];
        if (dbColumn) {
          if (searchMode === 'contains') {
            searchConditions.push(ilike(dbColumn, \`%\${searchTerm}%\`));
          } else if (searchMode === 'starts') {
            searchConditions.push(ilike(dbColumn, \`\${searchTerm}%\`));
          } else if (searchMode === 'ends') {
            searchConditions.push(ilike(dbColumn, \`%\${searchTerm}\`));
          } else if (searchMode === 'exact') {
            searchConditions.push(eq(dbColumn, searchTerm));
          }
        }
      }
      
      if (searchConditions.length > 0) {
        // Use OR for full-text search across multiple fields
        const searchClause = searchConditions.length === 1 ? searchConditions[0] : or(...searchConditions);
        if (searchClause) {
          conditions.push(searchClause);
        }
      }
    }
    
    if (conditions.length > 0) {
      const whereClause = conditions.length === 1 ? conditions[0] : and(...conditions);
      if (whereClause) {
        query = query.where(whereClause) as any;
      }
    }
    
    if (options?.orderBy) {
      const orderFieldName = options.orderBy.field;
      const orderColumnMap: Record<string, any> = {
${queryableFields.map(f => {
  const entries: string[] = [];
  if (f.apiFieldName !== f.dbColumnName) {
    entries.push(`        '${f.apiFieldName}': ${tableName}.${f.dbColumnName}`);
  }
  entries.push(`        '${f.dbColumnName}': ${tableName}.${f.dbColumnName}`);
  return entries.join(',\n');
}).join(',\n')}
      };
      const orderColumn = orderColumnMap[orderFieldName] || ${tableName}.${primaryDbColumn};
      query = query.orderBy(options.orderBy.direction === 'desc' ? desc(orderColumn) : asc(orderColumn)) as any;
    }
    
    if (options?.limit !== undefined) {
      query = query.limit(options.limit) as any;
    }
    
    if (options?.offset !== undefined) {
      query = query.offset(options.offset) as any;
    }
    
    const entities = await query;
    return entities.map(${mapperFromEntity});
  }

  /**
   * Update ${apiSchemaName} by ID
   */
  async update(id: string, input: ${updateInputName}): Promise<${apiSchemaName} | null> {
    const db = getDb();
    const entityData = ${mapperToEntity}(input) as any;
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

  return {
    classCode,
    schemaImport: tableName,
    mapperImports: `${mapperToEntity}, ${mapperFromEntity}`,
    typeImports: `${apiSchemaName}`,
    repositoryTypeImport: `${entityName}RepositoryMethods`
  };
}

/**
 * Generate type definitions for repository methods
 */
function generateRepositoryTypes(
  entityName: string,
  entityDef: EntityDefinition,
  typesImportPath: string,
  availableEntities: Set<string>
): string {
  const apiSchemaName = entityDef.apiSchema || entityName;
  // Use base type for inputs (Create/Update types may not be generated)
  const createInputName = apiSchemaName;
  const updateInputName = `Partial<${apiSchemaName}>`;
  
  const queryableFields = getQueryableFields(entityDef, availableEntities);
  
  // Find primary field
  let primaryField: [string, EntityField] | undefined;
  if (entityDef.fields) {
    for (const [fieldName, fieldDef] of Object.entries(entityDef.fields)) {
      const field = parseFieldDefinition(fieldName, fieldDef, availableEntities);
      if (field.primary) {
        primaryField = [fieldName, field];
        break;
      }
    }
  }
  const primaryFieldName = primaryField ? getApiFieldName(primaryField[0], primaryField[1]) || primaryField[0] : 'id';
  const primaryFieldNameRaw = primaryField ? primaryField[0] : 'id';
  
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
    // Skip primary field - it already has findById method
    if (field.fieldName === primaryFieldNameRaw) {
      continue;
    }
    
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
    
    // findByIdAnd{Field} - skip if this is the primary field itself
    if (field.fieldName !== primaryFieldNameRaw && field.apiFieldName.toLowerCase() !== primaryFieldName.toLowerCase()) {
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
      
      // Skip if field1 is the primary key to avoid duplicate with findByIdAnd{Field}
      if (field1.fieldName === primaryFieldNameRaw) {
        continue;
      }
      
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

import type { ${apiSchemaName} } from "${typesImportPath}";

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
  const classCodes: string[] = [];
  const schemaImports: string[] = [];
  const mapperImports: string[] = [];
  const typeImports: string[] = [];
  const repositoryTypeImports: string[] = [];
  const typeDefinitions: string[] = [];
  const availableEntities = new Set(Object.keys(entities));
  
  for (const [entityName, entityDef] of Object.entries(entities)) {
    const result = generateRepositoryClass(entityName, entityDef, typesImportPath, availableEntities);
    classCodes.push(result.classCode);
    schemaImports.push(result.schemaImport);
    mapperImports.push(result.mapperImports);
    typeImports.push(result.typeImports);
    repositoryTypeImports.push(result.repositoryTypeImport);
    typeDefinitions.push(generateRepositoryTypes(entityName, entityDef, typesImportPath, availableEntities));
  }
  
  // Build the repository file with imports at the top (only once)
  const repository = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

import { pgliteAdapter } from "@betagors/yama-pglite";
import { ${schemaImports.join(', ')} } from "./schema.ts";
import { ${mapperImports.join(', ')} } from "./mapper.ts";
import { eq, and, or, ilike, gt, lt, desc, asc } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import type { ${typeImports.join(', ')} } from "${typesImportPath.replace(/\.ts$/, '')}";
import type { ${repositoryTypeImports.join(', ')} } from "./repository-types.ts";
import type { drizzle } from "drizzle-orm/pglite";
import { randomUUID } from "crypto";

type Database = ReturnType<typeof drizzle>;

function getDb(): Database {
  try {
    return pgliteAdapter.getClient() as Database;
  } catch (error) {
    throw new Error("Database not initialized - ensure database is configured in yama.yaml");
  }
}

${classCodes.join('\n\n')}
`;
  
  return {
    repository,
    types: typeDefinitions.join('\n\n')
  };
}
