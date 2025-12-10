import { z } from "zod";

const inputSchema = z.object({
  description: z.string().describe("Natural language description of data model. Should describe entities, fields, relationships, and any constraints. Example: 'A blog system with Users who have Posts. Posts have a title, content, published status, and belong to a User. Posts can have many Tags through a many-to-many relationship.'"),
});

interface EntityField {
  name: string;
  type: string;
  required: boolean;
  constraints: string[];
  defaultValue?: string;
}

interface Entity {
  name: string;
  table: string;
  fields: EntityField[];
  relations: Array<{
    name: string;
    target: string;
    type: "belongsTo" | "hasMany" | "hasOne" | "manyToMany";
    cascade?: boolean;
    through?: string;
  }>;
}

function pluralize(name: string): string {
  if (name.endsWith("y")) {
    return name.slice(0, -1) + "ies";
  }
  if (name.endsWith("s") || name.endsWith("x") || name.endsWith("z") || name.endsWith("ch") || name.endsWith("sh")) {
    return name + "es";
  }
  return name + "s";
}

function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z])/g, "_$1")
    .toLowerCase()
    .replace(/^_/, "");
}

function inferFieldType(fieldName: string, description?: string): string {
  const lowerName = fieldName.toLowerCase();
  const lowerDesc = (description || "").toLowerCase();
  
  // Check field name patterns
  if (lowerName.includes("id") && lowerName !== "id") {
    return "uuid";
  }
  if (lowerName.includes("email")) {
    return "string";
  }
  if (lowerName.includes("password") || lowerName.includes("hash")) {
    return "string";
  }
  if (lowerName.includes("url") || lowerName.includes("uri") || lowerName.includes("link")) {
    return "string";
  }
  if (lowerName.includes("date") || lowerName.includes("time") || lowerName.includes("at")) {
    if (lowerName.includes("created") || lowerName.includes("updated") || lowerName.includes("deleted")) {
      return "timestamp";
    }
    return "timestamp";
  }
  if (lowerName.includes("count") || lowerName.includes("quantity") || lowerName.includes("number")) {
    return "integer";
  }
  if (lowerName.includes("price") || lowerName.includes("cost") || lowerName.includes("amount") || lowerName.includes("total")) {
    return "decimal";
  }
  if (lowerName.includes("is") || lowerName.includes("has") || lowerName.includes("can") || lowerName === "active" || lowerName === "published" || lowerName === "enabled") {
    return "boolean";
  }
  if (lowerName.includes("content") || lowerName.includes("body") || lowerName.includes("description") || lowerName.includes("bio")) {
    return "text";
  }
  if (lowerName.includes("name") || lowerName.includes("title") || lowerName.includes("slug")) {
    return "string";
  }
  
  // Check description
  if (lowerDesc.includes("email")) {
    return "string";
  }
  if (lowerDesc.includes("number") || lowerDesc.includes("count") || lowerDesc.includes("quantity")) {
    return "integer";
  }
  if (lowerDesc.includes("price") || lowerDesc.includes("cost") || lowerDesc.includes("money") || lowerDesc.includes("amount")) {
    return "decimal";
  }
  if (lowerDesc.includes("true") || lowerDesc.includes("false") || lowerDesc.includes("boolean")) {
    return "boolean";
  }
  if (lowerDesc.includes("text") || lowerDesc.includes("long") || lowerDesc.includes("content")) {
    return "text";
  }
  
  // Default
  return "string";
}

function parseDescription(description: string): {
  entities: Entity[];
  schemas: Array<{ name: string; fields: Array<{ name: string; type: string; required?: boolean }> }>;
} {
  const entities: Entity[] = [];
  const entityMap = new Map<string, Entity>();
  const lowerDesc = description.toLowerCase();
  
  // Extract entity names (capitalized words that might be entities)
  const entityNamePattern = /\b([A-Z][a-z]+(?:[A-Z][a-z]+)*)\b/g;
  const potentialEntities = new Set<string>();
  let match;
  
  while ((match = entityNamePattern.exec(description)) !== null) {
    const name = match[1];
    // Filter out common non-entity words
    if (!["User", "Post", "Tag", "Comment", "Order", "Product", "Customer"].includes(name) && 
        name.length > 2 && 
        !name.match(/^(The|A|An|This|That|These|Those|With|Have|Has|Can|Should|Will|May|Must)$/i)) {
      potentialEntities.add(name);
    }
  }
  
  // Common entity patterns
  const commonEntities = ["User", "Post", "Tag", "Comment", "Order", "Product", "Customer", "Author", "Article", "Blog", "Category"];
  for (const entityName of commonEntities) {
    if (lowerDesc.includes(entityName.toLowerCase()) || lowerDesc.includes(pluralize(entityName.toLowerCase()))) {
      potentialEntities.add(entityName);
    }
  }
  
  // Parse relationships
  const relationships: Array<{ from: string; to: string; type: string; description: string }> = [];
  
  // Pattern: "X has Y", "X belongs to Y", "X has many Y", "X has one Y"
  const relationPatterns = [
    /(\w+)\s+(?:has|have)\s+(?:many|multiple|several)\s+(\w+)/gi,
    /(\w+)\s+(?:has|have)\s+(?:a|an|one)\s+(\w+)/gi,
    /(\w+)\s+belongs?\s+to\s+(\w+)/gi,
    /(\w+)\s+(?:with|and)\s+(\w+)/gi,
    /(\w+)\s+(?:can|may)\s+have\s+(\w+)/gi,
  ];
  
  for (const pattern of relationPatterns) {
    let match;
    while ((match = pattern.exec(description)) !== null) {
      const from = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
      const to = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
      if (from && to && from !== to) {
        relationships.push({
          from,
          to,
          type: pattern.source.includes("many") ? "hasMany" : pattern.source.includes("one") ? "hasOne" : "belongsTo",
          description: match[0],
        });
      }
    }
  }
  
  // Create entities
  for (const entityName of potentialEntities) {
    if (!entityMap.has(entityName)) {
      const entity: Entity = {
        name: entityName,
        table: toSnakeCase(pluralize(entityName)),
        fields: [
          {
            name: "id",
            type: "uuid",
            required: true,
            constraints: [],
          },
        ],
        relations: [],
      };
      
      // Add common fields based on entity type
      if (entityName === "User") {
        entity.fields.push(
          { name: "email", type: "string", required: true, constraints: ["unique", "indexed"] },
          { name: "name", type: "string", required: true, constraints: [] },
          { name: "createdAt", type: "timestamp", required: false, constraints: [] },
          { name: "updatedAt", type: "timestamp", required: false, constraints: [] }
        );
      } else if (entityName === "Post" || entityName === "Article") {
        entity.fields.push(
          { name: "title", type: "string", required: true, constraints: ["indexed"] },
          { name: "content", type: "text", required: true, constraints: [] },
          { name: "published", type: "boolean", required: false, constraints: [], defaultValue: "false" },
          { name: "publishedAt", type: "timestamp", required: false, constraints: [] },
          { name: "createdAt", type: "timestamp", required: false, constraints: [] },
          { name: "updatedAt", type: "timestamp", required: false, constraints: [] }
        );
      } else if (entityName === "Tag" || entityName === "Category") {
        entity.fields.push(
          { name: "name", type: "string", required: true, constraints: ["unique"] },
          { name: "slug", type: "string", required: true, constraints: ["unique", "indexed"] },
          { name: "createdAt", type: "timestamp", required: false, constraints: [] }
        );
      } else if (entityName === "Comment") {
        entity.fields.push(
          { name: "content", type: "text", required: true, constraints: [] },
          { name: "createdAt", type: "timestamp", required: false, constraints: [] },
          { name: "updatedAt", type: "timestamp", required: false, constraints: [] }
        );
      } else {
        // Generic entity fields
        entity.fields.push(
          { name: "name", type: "string", required: true, constraints: [] },
          { name: "createdAt", type: "timestamp", required: false, constraints: [] },
          { name: "updatedAt", type: "timestamp", required: false, constraints: [] }
        );
      }
      
      entityMap.set(entityName, entity);
      entities.push(entity);
    }
  }
  
  // Add relationships
  for (const rel of relationships) {
    const fromEntity = entityMap.get(rel.from);
    const toEntity = entityMap.get(rel.to);
    
    if (fromEntity && toEntity) {
      if (rel.type === "hasMany") {
        fromEntity.relations.push({
          name: pluralize(rel.to.toLowerCase()),
          target: rel.to,
          type: "hasMany",
        });
      } else if (rel.type === "hasOne") {
        fromEntity.relations.push({
          name: rel.to.toLowerCase(),
          target: rel.to,
          type: "hasOne",
        });
      } else {
        // belongsTo
        fromEntity.relations.push({
          name: rel.to.toLowerCase(),
          target: rel.to,
          type: "belongsTo",
          cascade: true,
        });
      }
    }
  }
  
  // Generate schemas from entities
  const schemas = entities.map(entity => ({
    name: entity.name,
    fields: entity.fields.map(f => ({
      name: f.name,
      type: f.type === "uuid" ? "string" : f.type === "timestamp" ? "string" : f.type,
      required: f.required,
    })),
  }));
  
  return { entities, schemas };
}

function generateYaml(entities: Entity[], schemas: Array<{ name: string; fields: Array<{ name: string; type: string; required?: boolean }> }>): string {
  const lines: string[] = [];
  
  // Generate entities section
  lines.push("entities:");
  for (const entity of entities) {
    lines.push(`  ${entity.name}:`);
    lines.push(`    table: ${entity.table}`);
    lines.push("    fields:");
    
    for (const field of entity.fields) {
      const constraints: string[] = [];
      if (field.required) {
        constraints.push("!");
      }
      constraints.push(...field.constraints);
      
      const constraintStr = constraints.length > 0 ? " " + constraints.join(" ") : "";
      const defaultStr = field.defaultValue ? ` = ${field.defaultValue}` : "";
      lines.push(`      ${field.name}: ${field.type}${constraintStr}${defaultStr}`);
    }
    
    // Add inline relations
    for (const rel of entity.relations) {
      if (rel.type === "belongsTo") {
        const cascadeStr = rel.cascade ? " cascade" : "";
        lines.push(`      ${rel.name}: ${rel.target}!${cascadeStr}`);
      } else if (rel.type === "hasMany") {
        lines.push(`      ${rel.name}: ${rel.target}[]`);
      } else if (rel.type === "hasOne") {
        lines.push(`      ${rel.name}: ${rel.target}?`);
      } else if (rel.type === "manyToMany") {
        const throughStr = rel.through ? ` through:${rel.through}` : "";
        lines.push(`      ${rel.name}: ${rel.target}[]${throughStr}`);
      }
    }
    
    lines.push(""); // Empty line between entities
  }
  
  // Generate schemas section (optional, can be auto-generated from entities)
  if (schemas.length > 0) {
    lines.push("schemas:");
    for (const schema of schemas) {
      lines.push(`  ${schema.name}:`);
      lines.push("    type: object");
      lines.push("    properties:");
      for (const field of schema.fields) {
        lines.push(`      ${field.name}:`);
        if (field.type === "string") {
          lines.push(`        type: string`);
        } else if (field.type === "integer") {
          lines.push(`        type: integer`);
        } else if (field.type === "boolean") {
          lines.push(`        type: boolean`);
        } else if (field.type === "text") {
          lines.push(`        type: string`);
        } else if (field.type === "decimal") {
          lines.push(`        type: number`);
        } else {
          lines.push(`        type: ${field.type}`);
        }
        if (field.name === "id" || field.name.includes("Id")) {
          lines.push(`        format: uuid`);
        }
        if (field.name.includes("At") || field.name.includes("date") || field.name.includes("time")) {
          lines.push(`        format: date-time`);
        }
        if (field.name === "email") {
          lines.push(`        format: email`);
        }
        if (!field.required && field.name !== "id") {
          lines.push(`        nullable: true`);
        }
      }
      lines.push(""); // Empty line between schemas
    }
  }
  
  return lines.join("\n");
}

export const yamaSchemaGenerateTool = {
  name: "yama_schema_generate",
  description: "Generates YAML schema definitions (entities and API schemas) from a natural language description. Use this tool when the user asks to generate schema, create schema from description, generate entities, or create data model. The tool analyzes the description to identify entities, fields, relationships, and generates appropriate YAML that can be added to yama.yaml.",
  inputSchema,
  handler: async (args: z.infer<typeof inputSchema>) => {
    try {
      const { entities, schemas } = parseDescription(args.description);
      
      if (entities.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "❌ Could not identify any entities from the description. Please provide a more detailed description with entity names (e.g., 'User', 'Post', 'Tag').",
            },
          ],
        };
      }
      
      const yaml = generateYaml(entities, schemas);
      
      const summary = `Generated ${entities.length} entity/entities and ${schemas.length} schema(s) from description.\n\nGenerated YAML:\n\n${yaml}`;
      
      return {
        content: [
          {
            type: "text" as const,
            text: summary,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `❌ Error generating schema: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};
