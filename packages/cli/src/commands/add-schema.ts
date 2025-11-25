import inquirer from "inquirer";
import { existsSync } from "fs";
import { readYamaConfig, writeYamaConfig } from "../utils/file-utils.ts";
import { findYamaConfig } from "../utils/project-detection.ts";
import { success, error } from "../utils/cli-utils.ts";

interface AddSchemaOptions {
  config?: string;
}

interface SchemaField {
  type?: string;
  $ref?: string;
  required?: boolean;
  default?: unknown;
  items?: {
    type?: string;
    $ref?: string;
  };
}

interface SchemaDefinition {
  fields: Record<string, SchemaField>;
}

export async function addSchemaCommand(options: AddSchemaOptions): Promise<void> {
  const configPath = options.config || findYamaConfig() || "yama.yaml";

  if (!existsSync(configPath)) {
    error(`Config file not found: ${configPath}`);
    process.exit(1);
  }

  try {
    const config = readYamaConfig(configPath) as {
      schemas?: Record<string, SchemaDefinition>;
    };

    // Get existing schema names
    const existingSchemas = config.schemas ? Object.keys(config.schemas) : [];

    console.log("\n📦 Add New Schema\n");

    // Prompt for schema name
    const schemaInfo = await inquirer.prompt([
      {
        type: "input",
        name: "name",
        message: "Schema name:",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) {
            return "Schema name is required";
          }
          if (!/^[A-Z][a-zA-Z0-9_]*$/.test(input)) {
            return "Schema name must start with uppercase letter and contain only letters, numbers, and underscores";
          }
          if (existingSchemas.includes(input)) {
            return "Schema with this name already exists";
          }
          return true;
        },
      },
    ]);

    const fields: Record<string, SchemaField> = {};
    let addMore = true;

    console.log("\n📝 Add fields to the schema:\n");

    while (addMore) {
      const fieldInfo = await inquirer.prompt([
        {
          type: "input",
          name: "name",
          message: "Field name:",
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
            "string",
            "number",
            "integer",
            "boolean",
            "array",
            "object",
            "Reference to another schema",
          ],
        },
        {
          type: "list",
          name: "refSchema",
          message: "Reference which schema?",
          choices: existingSchemas,
          when: (answers) => answers.type === "Reference to another schema",
        },
        {
          type: "list",
          name: "arrayItemType",
          message: "Array item type:",
          choices: [
            "string",
            "number",
            "integer",
            "boolean",
            "object",
            "Reference to another schema",
          ],
          when: (answers) => answers.type === "array",
        },
        {
          type: "list",
          name: "arrayItemRef",
          message: "Reference which schema?",
          choices: existingSchemas,
          when: (answers) => answers.type === "array" && answers.arrayItemType === "Reference to another schema",
        },
        {
          type: "confirm",
          name: "required",
          message: "Is this field required?",
          default: true,
        },
        {
          type: "input",
          name: "defaultValue",
          message: "Default value (optional, leave empty for none):",
          when: (answers) => !answers.required,
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
          name: "addMore",
          message: "Add another field?",
          default: true,
        },
      ]);

      const field: SchemaField = {};

      if (fieldInfo.type === "Reference to another schema") {
        field.$ref = fieldInfo.refSchema;
      } else if (fieldInfo.type === "array") {
        field.type = "array";
        if (fieldInfo.arrayItemType === "Reference to another schema") {
          field.items = { $ref: fieldInfo.arrayItemRef };
        } else {
          field.items = { type: fieldInfo.arrayItemType };
        }
      } else {
        field.type = fieldInfo.type;
      }

      if (fieldInfo.required) {
        field.required = true;
      }

      if (fieldInfo.defaultValue !== undefined) {
        field.default = fieldInfo.defaultValue;
      }

      fields[fieldInfo.name] = field;

      addMore = fieldInfo.addMore;
    }

    // Add schema to config
    if (!config.schemas) {
      config.schemas = {};
    }

    config.schemas[schemaInfo.name] = {
      fields,
    };

    // Write updated config
    writeYamaConfig(configPath, config);

    success(`Schema "${schemaInfo.name}" added successfully with ${Object.keys(fields).length} field(s)!`);

    console.log("\n💡 Next steps:");
    console.log("   1. Use this schema in endpoints or entities");
    console.log("   2. Run 'yama generate' to update types and SDK");
  } catch (err) {
    error(`Failed to add schema: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

