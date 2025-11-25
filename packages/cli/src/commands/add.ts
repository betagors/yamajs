import inquirer from "inquirer";
import { addEndpointCommand } from "./add-endpoint.ts";
import { addSchemaCommand } from "./add-schema.ts";
import { addEntityCommand } from "./add-entity.ts";

interface AddOptions {
  config?: string;
  type?: string;
}

export async function addCommand(options: AddOptions): Promise<void> {
  // If type is specified, route directly to that command
  if (options.type) {
    switch (options.type.toLowerCase()) {
      case "endpoint":
        await addEndpointCommand(options);
        return;
      case "schema":
        await addSchemaCommand(options);
        return;
      case "entity":
        await addEntityCommand(options);
        return;
      default:
        console.error(`❌ Unknown type: ${options.type}`);
        console.error("   Available types: endpoint, schema, entity");
        process.exit(1);
    }
  }

  // Otherwise, prompt for type
  console.log("\n✨ Add to Yama Project\n");

  const { type } = await inquirer.prompt([
    {
      type: "list",
      name: "type",
      message: "What would you like to add?",
      choices: [
        { name: "📡 Endpoint", value: "endpoint" },
        { name: "📦 Schema", value: "schema" },
        { name: "🗄️  Entity", value: "entity" },
      ],
    },
  ]);

  switch (type) {
    case "endpoint":
      await addEndpointCommand(options);
      break;
    case "schema":
      await addSchemaCommand(options);
      break;
    case "entity":
      await addEntityCommand(options);
      break;
    default:
      console.error(`❌ Unknown type: ${type}`);
      process.exit(1);
  }
}

