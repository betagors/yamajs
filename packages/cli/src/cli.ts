#!/usr/bin/env node
import { Command } from "commander";
import { createCommand } from "./commands/create.ts";
import { devCommand } from "./commands/dev.ts";
import { generateCommand } from "./commands/generate.ts";
import { validateCommand } from "./commands/validate.ts";
import { configCommand } from "./commands/config.ts";
import { endpointsCommand } from "./commands/endpoints.ts";
import { schemasCommand } from "./commands/schemas.ts";
import { docsCommand } from "./commands/docs.ts";
import { schemaCheckCommand } from "./commands/schema-check.ts";
import { schemaGenerateCommand } from "./commands/schema-generate.ts";
import { schemaApplyCommand } from "./commands/schema-apply.ts";
import { schemaStatusCommand } from "./commands/schema-status.ts";
import { schemaWatchCommand } from "./commands/schema-watch.ts";
import { schemaHistoryCommand } from "./commands/schema-history.ts";
import { schemaScaffoldCommand } from "./commands/schema-scaffold.ts";
import { schemaFixCommand } from "./commands/schema-fix.ts";
import { schemaEnvCommand } from "./commands/schema-env.ts";
import { schemaTrashCommand } from "./commands/schema-trash.ts";
import { schemaRestoreCommand } from "./commands/schema-restore.ts";
import { pluginListCommand, pluginInstallCommand, pluginValidateCommand } from "./commands/plugin.ts";
import { dbListCommand } from "./commands/db-list.ts";
import { dbInspectCommand } from "./commands/db-inspect.ts";
import { addCommand } from "./commands/add.ts";
import { addEndpointCommand } from "./commands/add-endpoint.ts";
import { addSchemaCommand } from "./commands/add-schema.ts";
import { addEntityCommand } from "./commands/add-entity.ts";

const program = new Command();

program
  .name("yama")
  .description("Yama CLI - API framework toolkit")
  .version("0.0.1");

// Project creation
program
  .command("create")
  .alias("new")
  .description("Create a new Yama project (like Next.js)")
  .argument("[project-name]", "Project name or '.' for current directory")
  .option("--database <database>", "Database type (postgresql, none)")
  .option("-y, --yes", "Use default options (non-interactive mode)")
  .action(async (projectName, options) => {
    await createCommand(projectName, options);
  });

// Development
program
  .command("dev")
  .description("Start development server with watch mode")
  .option("-p, --port <port>", "Server port", "4000")
  .option("--no-watch", "Disable watch mode")
  .option("--config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--generate", "Auto-generate SDK and types on startup and changes")
  .option("--env <env>", "Environment (development, production, staging, etc.)", "development")
  .action(devCommand);

// Generation
program
  .command("generate")
  .alias("gen")
  .description("Generate SDK and types")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-o, --output <path>", "Output path for generated files")
  .option("--watch", "Watch mode - regenerate on changes")
  .option("--types-only", "Generate types only")
  .option("--sdk-only", "Generate SDK only")
  .option("--framework <framework>", "Framework type (nextjs, react, node)")
  .option("--no-cache", "Disable caching")
  .action(generateCommand);

program
  .command("types")
  .description("Generate TypeScript types only")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-o, --output <path>", "Output path for types")
  .action(async (options) => {
    await generateCommand({ ...options, typesOnly: true });
  });

program
  .command("sdk")
  .description("Generate SDK only")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-o, --output <path>", "Output path for SDK")
  .option("--framework <framework>", "Framework type (nextjs, react, node)")
  .action(async (options) => {
    await generateCommand({ ...options, sdkOnly: true });
  });

// Validation & inspection
program
  .command("validate")
  .description("Validate yama.yaml configuration")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--strict", "Enable strict validation")
  .action(validateCommand);

program
  .command("config")
  .description("Show current configuration")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(configCommand);

program
  .command("endpoints")
  .description("List all endpoints")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(endpointsCommand);

program
  .command("schemas")
  .description("List all schemas")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(schemasCommand);

// Add commands
program
  .command("add")
  .description("Add endpoint, schema, or entity to yama.yaml")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-t, --type <type>", "Type to add (endpoint, schema, entity)")
  .action(addCommand);

program
  .command("add:endpoint")
  .alias("add-endpoint")
  .description("Add a new endpoint")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(async (options) => {
    await addEndpointCommand(options);
  });

program
  .command("add:schema")
  .alias("add-schema")
  .description("Add a new schema")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(async (options) => {
    await addSchemaCommand(options);
  });

program
  .command("add:entity")
  .alias("add-entity")
  .description("Add a new entity")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(async (options) => {
    await addEntityCommand(options);
  });

program
  .command("docs")
  .description("Generate API documentation")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-f, --format <format>", "Output format (openapi, json, yaml, swagger-ui, html, markdown, md)", "openapi")
  .option("-o, --output <path>", "Output path for generated documentation")
  .action(docsCommand);

// Schema management
program
  .command("schema:check")
  .description("Check if schema is in sync with database")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--diff", "Show detailed diff")
  .option("--ci", "CI mode: minimal output, exit code only")
  .option("--env <env>", "Environment (local, staging, prod)", "local")
  .action(schemaCheckCommand);

program
  .command("schema:generate")
  .description("Generate migration from schema changes")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-n, --name <name>", "Migration name")
  .option("--preview", "Preview changes without generating files")
  .option("--interactive", "Interactive mode")
  .action(schemaGenerateCommand);

program
  .command("schema:apply")
  .description("Apply pending migrations")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment (local, staging, prod)", "local")
  .option("--no-apply", "Generate files only, don't apply")
  .option("--interactive", "Prompt before each migration")
  .option("--allow-destructive", "Allow destructive operations")
  .action(schemaApplyCommand);

program
  .command("schema:status")
  .description("Check migration status")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--short", "Short output format")
  .option("--env <env>", "Environment (local, staging, prod)", "local")
  .action(schemaStatusCommand);

program
  .command("schema:watch")
  .description("Watch for schema changes and auto-check")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(schemaWatchCommand);

program
  .command("schema:history")
  .description("Show migration history")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--graph", "Show timeline graph")
  .option("--env <env>", "Environment (local, staging, prod)", "local")
  .action(schemaHistoryCommand);

program
  .command("schema:scaffold")
  .description("Scaffold schema changes")
  .argument("<action>", "Action: add-table or add-column")
  .argument("[args...]", "Arguments for the action")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(async (action, args, options) => {
    await schemaScaffoldCommand(action, args, options);
  });

program
  .command("schema:fix")
  .description("Fix schema issues")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--action <action>", "Fix action (drift, validate-migrations)", "drift")
  .action(schemaFixCommand);

program
  .command("schema:env")
  .description("Manage environments")
  .argument("[action]", "Action: list or set")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment name (for set action)")
  .action(async (action, options) => {
    await schemaEnvCommand(action, options);
  });

program
  .command("schema:trash")
  .description("Manage trash/recycle bin for migrations")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--list", "List trash entries")
  .option("--restore <id>", "Restore entry from trash")
  .option("--delete <id>", "Permanently delete entry")
  .option("--cleanup", "Clean up expired entries")
  .option("--dry-run", "Dry run for cleanup")
  .action(schemaTrashCommand);

program
  .command("schema:restore")
  .description("Restore data from snapshots")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--list", "List available snapshots")
  .option("--snapshot <name>", "Snapshot table name")
  .option("--table <table>", "Target table name")
  .action(schemaRestoreCommand);

// Service plugins
const pluginCommand = program
  .command("plugin")
  .description("Manage service plugins");

pluginCommand
  .command("list")
  .description("List installed service plugins")
  .action(pluginListCommand);

pluginCommand
  .command("install")
  .description("Install a service plugin")
  .argument("<package>", "Package name to install")
  .action(async (packageName) => {
    await pluginInstallCommand({ package: packageName });
  });

pluginCommand
  .command("validate")
  .description("Validate all installed service plugins")
  .action(pluginValidateCommand);

// Database inspection
const dbCommand = program
  .command("db")
  .description("Database inspection and management");

dbCommand
  .command("list")
  .description("List all database tables with row counts")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action(dbListCommand);

dbCommand
  .command("inspect")
  .description("Inspect a specific table (schema and sample data)")
  .argument("<table>", "Table name to inspect")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action(async (table, options) => {
    await dbInspectCommand(table, options);
  });

program.parse();

