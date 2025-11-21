#!/usr/bin/env node
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { setupCommand } from "./commands/setup.js";
import { devCommand } from "./commands/dev.js";
import { generateCommand } from "./commands/generate.js";
import { validateCommand } from "./commands/validate.js";
import { configCommand } from "./commands/config.js";
import { endpointsCommand } from "./commands/endpoints.js";
import { schemasCommand } from "./commands/schemas.js";
import { docsCommand } from "./commands/docs.js";
import { schemaCheckCommand } from "./commands/schema-check.js";
import { schemaGenerateCommand } from "./commands/schema-generate.js";
import { schemaApplyCommand } from "./commands/schema-apply.js";
import { schemaStatusCommand } from "./commands/schema-status.js";
import { schemaWatchCommand } from "./commands/schema-watch.js";
import { schemaHistoryCommand } from "./commands/schema-history.js";
import { schemaScaffoldCommand } from "./commands/schema-scaffold.js";
import { schemaFixCommand } from "./commands/schema-fix.js";
import { schemaEnvCommand } from "./commands/schema-env.js";
import { schemaTrashCommand } from "./commands/schema-trash.js";
import { schemaRestoreCommand } from "./commands/schema-restore.js";
import { pluginListCommand, pluginInstallCommand, pluginValidateCommand } from "./commands/plugin.js";

const program = new Command();

program
  .name("yama")
  .description("Yama CLI - API framework toolkit")
  .version("0.0.1");

// Setup & initialization
program
  .command("init")
  .description("Initialize a new Yama project")
  .option("--name <name>", "Project name")
  .option("--version <version>", "Project version", "1.0.0")
  .action(initCommand);

program
  .command("setup")
  .description("Setup Yama in an existing project")
  .option("--skip-scripts", "Skip adding scripts to package.json")
  .action(setupCommand);

// Development
program
  .command("dev")
  .description("Start development server with watch mode")
  .option("-p, --port <port>", "Server port", "4000")
  .option("--no-watch", "Disable watch mode")
  .option("--config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--generate", "Auto-generate SDK and types on startup and changes")
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

program.parse();

