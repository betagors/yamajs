import inquirer from "inquirer";
import { existsSync } from "fs";
import { readYamaConfig, writeYamaConfig } from "../utils/file-utils.ts";
import { findYamaConfig } from "../utils/project-detection.ts";
import { success, error } from "../utils/cli-utils.ts";

interface AddEntityOptions {
  config?: string;
}

interface EntityField {
  type: string;
  primary?: boolean;
  generated?: boolean;
  required?: boolean;
  default?: unknown;
  unique?: boolean;
  index?: boolean;
}

interface EntityDefinition {
  table: string;
  fields: Record<string, EntityField>;
  indexes?: Array<{
    columns: string[];
    unique?: boolean;
  }>;
  apiSchema?: string;
  crud?: boolean | {
    enabled?: string[] | boolean;
    path?: string;
    auth?: {
      required?: boolean;
      roles?: string[];
    };
  };
}

export async function addEntityCommand(options: AddEntityOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as {
      entities?: Record<string, EntityDefinition>;
    };

    // Get existing entity names
    const existingEntities = config.entities ? Object.keys(config.entities) : [];

    console.log("\n🗄️  Add New Entity\n");

    // Prompt for entity name
    const entityInfo = await (inquirer.prompt as any)([
      {
        type: "input",
        name: "name",
        message: "Entity name (PascalCase):",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Entity name is required";
          }
          if (!/^[A-Z][a-zA-Z0-9_]*$/.test(input)) {
            return "Entity name must start with uppercase letter and contain only letters, numbers, and underscores";
          }
          if (existingEntities.includes(input)) {
            return "Entity with this name already exists";
          }
          return true;
        },
      },
      {
        type: "input",
        name: "table",
        message: "Database table name (snake_case):",
        default: (answers: { name: string }) => {
          // Convert PascalCase to snake_case
          return answers.name
            .replace(/([A-Z])/g, "_$1")
            .toLowerCase()
            .replace(/^_/, "");
        },
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Table name is required";
          }
          if (!/^[a-z][a-z0-9_]*$/.test(input)) {
            return "Table name must be lowercase and contain only letters, numbers, and underscores";
          }
          return true;
        },
      },
    ]);

    const fields: Record<string, EntityField> = {};
    let hasPrimaryKey = false;
    let addMore = true;

    console.log("\n📝 Add fields to the entity:\n");

    while (addMore) {
      const fieldInfo = await (inquirer.prompt as any)([
        {
          type: "input",
          name: "name",
          message: "Field name (camelCase):",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "Field name is required";
            }
            if (!/^[a-z][a-zA-Z0-9_]*$/.test(input)) {
              return "Field name must start with lowercase letter and contain only letters, numbers, and underscores";
            }
            if (fields[input]) {
              return "Field already exists";
            }
            return true;
          },
        },
        {
          type: "list",
          name: "type",
          message: "Field type:",
          choices: [
            "uuid",
            "string",
            "text",
            "number",
            "integer",
            "boolean",
            "date",
            "timestamp",
            "json",
            "jsonb",
          ],
        },
        {
          type: "confirm",
          name: "isPrimary",
          message: "Is this the primary key?",
          default: !hasPrimaryKey && Object.keys(fields).length === 0,
          when: () => !hasPrimaryKey,
        },
        {
          type: "confirm",
          name: "isGenerated",
          message: "Is this field auto-generated?",
          default: (answers: { isPrimary?: boolean; type: string }) => {
            return answers.isPrimary || answers.type === "uuid";
          },
          when: (answers: { isPrimary?: boolean }) => answers.isPrimary,
        },
        {
          type: "confirm",
          name: "required",
          message: "Is this field required (NOT NULL)?",
          default: true,
          when: (answers: { isPrimary?: boolean; isGenerated?: boolean }) => 
            !answers.isPrimary || !answers.isGenerated,
        },
        {
          type: "input",
          name: "defaultValue",
          message: "Default value (optional, leave empty for none):",
          when: (answers: { required: boolean; isGenerated?: boolean }) => 
            !answers.required && !answers.isGenerated,
          filter: (input: string) => {
            if (!input || input.trim().length === 0) return undefined;
            // Try to parse as JSON, fallback to string
            try {
              return JSON.parse(input);
            } catch {
              return input;
            }
          },
        },
        {
          type: "confirm",
          name: "unique",
          message: "Is this field unique?",
          default: false,
        },
        {
          type: "confirm",
          name: "indexed",
          message: "Should this field be indexed?",
          default: false,
        },
        {
          type: "confirm",
          name: "addMore",
          message: "Add another field?",
          default: true,
        },
      ]);

      const field: EntityField = {
        type: fieldInfo.type,
      };

      if (fieldInfo.isPrimary) {
        field.primary = true;
        hasPrimaryKey = true;
      }

      if (fieldInfo.isGenerated) {
        field.generated = true;
      }

      if (fieldInfo.required) {
        field.required = true;
      }

      if (fieldInfo.defaultValue !== undefined) {
        field.default = fieldInfo.defaultValue;
      }

      if (fieldInfo.unique) {
        field.unique = true;
      }

      if (fieldInfo.indexed) {
        field.index = true;
      }

      fields[fieldInfo.name] = field;

      addMore = fieldInfo.addMore;
    }

    // Ensure we have a primary key
    if (!hasPrimaryKey) {
      error("Entity must have at least one primary key field");
      process.exit(1);
    }

    // Ask about CRUD endpoints
    const crudInfo = await (inquirer.prompt as any)([
      {
        type: "confirm",
        name: "enableCrud",
        message: "Enable CRUD endpoints for this entity?",
        default: true,
      },
      {
        type: "checkbox",
        name: "crudMethods",
        message: "Which CRUD methods to enable?",
        choices: [
          { name: "GET (list all)", value: "GET" },
          { name: "GET (by ID)", value: "GET_ID" },
          { name: "POST (create)", value: "POST" },
          { name: "PUT (full update)", value: "PUT" },
          { name: "PATCH (partial update)", value: "PATCH" },
          { name: "DELETE", value: "DELETE" },
        ],
        when: (answers: { enableCrud: boolean }) => answers.enableCrud,
      },
      {
        type: "input",
        name: "crudPath",
        message: "Custom CRUD base path (optional, press Enter for default):",
        when: (answers: { enableCrud: boolean }) => answers.enableCrud,
        filter: (input: string) => {
          if (!input || input.trim().length === 0) return undefined;
          return input;
        },
      },
      {
        type: "confirm",
        name: "crudAuth",
        message: "Require authentication for CRUD endpoints?",
        default: false,
        when: (answers: { enableCrud: boolean }) => answers.enableCrud,
      },
      {
        type: "input",
        name: "crudRoles",
        message: "Required roles (comma-separated, optional):",
        when: (answers: { enableCrud: boolean; crudAuth: boolean }) => 
          answers.enableCrud && answers.crudAuth,
        filter: (input: string) => {
          if (!input || input.trim().length === 0) return undefined;
          return input.split(",").map((r) => r.trim()).filter((r) => r.length > 0);
        },
      },
    ]);

    // Build entity definition
    const entity: EntityDefinition = {
      table: entityInfo.table,
      fields,
    };

    // Add CRUD config if enabled
    if (crudInfo.enableCrud) {
      if (crudInfo.crudMethods.length === 6) {
        // All methods enabled
        entity.crud = true;
      } else {
        // Specific methods enabled
        const enabledMethods = crudInfo.crudMethods.map((m: string) => {
          if (m === "GET_ID") return "GET";
          return m;
        });
        entity.crud = {
          enabled: enabledMethods,
        };
      }

      if (crudInfo.crudPath) {
        if (typeof entity.crud === "object") {
          entity.crud.path = crudInfo.crudPath;
        } else {
          entity.crud = {
            enabled: true,
            path: crudInfo.crudPath,
          };
        }
      }

      if (crudInfo.crudAuth) {
        if (typeof entity.crud === "object") {
          entity.crud.auth = {
            required: true,
          };
          if (crudInfo.crudRoles && crudInfo.crudRoles.length > 0) {
            entity.crud.auth.roles = crudInfo.crudRoles;
          }
        } else {
          entity.crud = {
            enabled: true,
            auth: {
              required: true,
              roles: crudInfo.crudRoles,
            },
          };
        }
      }
    }

    // Add entity to config
    if (!config.entities) {
      config.entities = {};
    }

    config.entities[entityInfo.name] = entity;

    // Write updated config
    writeYamaConfig(configPath, config);

    success(`Entity "${entityInfo.name}" added successfully with ${Object.keys(fields).length} field(s)!`);

    if (crudInfo.enableCrud) {
      success(`CRUD endpoints enabled for "${entityInfo.name}"`);
    }

    console.log("\n💡 Next steps:");
    console.log("   1. Run 'yama schema:generate' to create a migration");
    console.log("   2. Run 'yama schema:apply' to apply the migration");
    console.log("   3. Run 'yama generate' to update types and SDK");
  } catch (err) {
    error(`Failed to add entity: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

