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
import { schemaRollbackCommand } from "./commands/schema-rollback.ts";
import { pluginListCommand, pluginInstallCommand, pluginValidateCommand } from "./commands/plugin.ts";
import { pluginMigrateCommand } from "./commands/plugin-migrate.ts";
import { pluginRollbackCommand } from "./commands/plugin-rollback.ts";
import { migrationCreateCommand } from "./commands/migration-create.ts";
import { pluginStatusCommand } from "./commands/plugin-status.ts";
import { pluginHealthCommand } from "./commands/plugin-health.ts";
import { pluginSearchCommand } from "./commands/plugin-search.ts";
import { pluginInfoCommand } from "./commands/plugin-info.ts";
import { pluginDocsCommand } from "./commands/plugin-docs.ts";
import { pluginMetricsCommand } from "./commands/plugin-metrics.ts";
import { dbListCommand } from "./commands/db-list.ts";
import { dbInspectCommand } from "./commands/db-inspect.ts";
import { addCommand } from "./commands/add.ts";
import { addEndpointCommand } from "./commands/add-endpoint.ts";
import { addSchemaCommand } from "./commands/add-schema.ts";
import { addEntityCommand } from "./commands/add-entity.ts";
import { addHandlerCommand } from "./commands/add-handler.ts";
import { addPluginCommand } from "./commands/add-plugin.ts";
import { removePluginCommand } from "./commands/remove-plugin.ts";
import { syncPluginsCommand } from "./commands/sync-plugins.ts";
import { snapshotListCommand } from "./commands/snapshot-list.ts";
import { snapshotCreateCommand } from "./commands/snapshot-create.ts";
import { transitionCreateCommand } from "./commands/transition-create.ts";
import { resolveCommand } from "./commands/resolve.ts";
import { ciAnalyzeCommand, ciValidateCommand } from "./commands/ci.ts";

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
  .command("add:handler")
  .alias("add-handler")
  .description("Add a new handler")
  .requiredOption("-n, --name <name>", "Handler name (required)")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-f, --force", "Override existing handler file")
  .action(async (options) => {
    await addHandlerCommand(options);
  });

program
  .command("add:plugin")
  .alias("add-plugin")
  .description("Add a plugin to yama.yaml and install it")
  .requiredOption("-n, --name <name>", "Plugin package name (required)")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--config-only", "Only add to yama.yaml, don't install package")
  .action(async (options) => {
    await addPluginCommand(options);
  });

program
  .command("remove:plugin")
  .alias("remove-plugin")
  .description("Remove a plugin from yama.yaml and uninstall it")
  .requiredOption("-n, --name <name>", "Plugin package name (required)")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--keep-package", "Keep the npm package, only remove from yama.yaml")
  .action(async (options) => {
    await removePluginCommand(options);
  });

program
  .command("sync:plugins")
  .alias("sync-plugins")
  .description("Sync plugins: install plugins from yama.yaml that aren't installed")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--remove", "Also remove plugins from package.json that aren't in yama.yaml")
  .action(async (options) => {
    await syncPluginsCommand(options);
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
  .command("schema:rollback")
  .description("Rollback applied migrations")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--steps <number>", "Number of migrations to rollback (default: 1)")
  .option("--to <migration>", "Rollback to a specific migration name")
  .option("--dry-run", "Show what would be rolled back without executing")
  .option("--env <env>", "Environment (local, staging, prod)", "local")
  .option("--force", "Skip confirmation prompts and safety checks (use with extreme caution)")
  .option("--skip-confirm", "Skip confirmation prompts")
  .action(async (options) => {
    await schemaRollbackCommand(options);
  });

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

program
  .command("migration:create")
  .alias("migrate:create")
  .description("Create a new custom migration file")
  .option("-n, --name <name>", "Migration name")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--type <type>", "Migration type (schema, data, custom)", "schema")
  .option("--template <template>", "Template to use (empty, table, column, index)", "empty")
  .action(async (options) => {
    await migrationCreateCommand(options);
  });

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

pluginCommand
  .command("migrate")
  .description("Run pending plugin migrations")
  .option("--plugin <name>", "Migrate specific plugin only")
  .option("--all", "Migrate all plugins")
  .option("--dry-run", "Show what would be migrated without executing")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment (development, production, etc.)", "development")
  .option("--force", "Skip confirmation prompts (use with caution)")
  .option("--skip-confirm", "Skip confirmation prompts")
  .option("--interactive", "Prompt before applying each plugin's migrations")
  .action(async (options) => {
    await pluginMigrateCommand(options);
  });

pluginCommand
  .command("rollback")
  .description("Rollback plugin migrations")
  .argument("[plugin]", "Plugin name to rollback")
  .option("--to-version <version>", "Target version to rollback to")
  .option("--steps <number>", "Number of migrations to rollback")
  .option("--dry-run", "Show what would be rolled back without executing")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment (development, production, etc.)", "development")
  .option("--force", "Skip confirmation prompts and safety checks (use with extreme caution)")
  .option("--skip-confirm", "Skip confirmation prompts")
  .action(async (pluginName, options) => {
    if (!pluginName) {
      console.error("Error: Plugin name is required");
      console.error("Usage: yama plugin rollback <plugin> [--to-version <version> | --steps <number>]");
      process.exit(1);
    }
    if (!options.toVersion && !options.steps) {
      console.error("Error: Either --to-version or --steps must be specified");
      process.exit(1);
    }
    // Parse steps as number if provided
    if (options.steps) {
      options.steps = parseInt(options.steps as string, 10);
      if (isNaN(options.steps)) {
        console.error("Error: --steps must be a valid number");
        process.exit(1);
      }
    }
    await pluginRollbackCommand(pluginName, options);
  });

pluginCommand
  .command("status")
  .description("Show plugin migration status")
  .option("--plugin <name>", "Show status for specific plugin only")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment (development, production, etc.)", "development")
  .action(async (options) => {
    await pluginStatusCommand(options);
  });

pluginCommand
  .command("health")
  .description("Check plugin health status")
  .option("--plugin <name>", "Check health for specific plugin only")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment (development, production, etc.)", "development")
  .action(async (options) => {
    await pluginHealthCommand(options);
  });

pluginCommand
  .command("search")
  .description("Search for plugins on npm")
  .argument("<query>", "Search query")
  .option("--category <category>", "Filter by category")
  .option("--limit <number>", "Limit number of results", "20")
  .action(async (query, options) => {
    await pluginSearchCommand({ query, ...options });
  });

pluginCommand
  .command("info")
  .description("Show detailed plugin information")
  .argument("<package>", "Package name")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(async (packageName, options) => {
    await pluginInfoCommand({ package: packageName, ...options });
  });

pluginCommand
  .command("docs")
  .description("Generate plugin documentation")
  .argument("<package>", "Package name")
  .option("--format <format>", "Output format (markdown, html)", "markdown")
  .option("-o, --output <path>", "Output file path (default: stdout)")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(async (packageName, options) => {
    await pluginDocsCommand({ package: packageName, ...options });
  });

pluginCommand
  .command("metrics")
  .description("Show plugin performance metrics")
  .option("--plugin <name>", "Show metrics for specific plugin only")
  .option("--reset", "Clear all metrics")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--env <env>", "Environment (development, production, etc.)", "development")
  .option("--format <format>", "Output format (table, prometheus, json)", "table")
  .action(async (options) => {
    await pluginMetricsCommand(options);
  });

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

// Snapshot commands
const snapshotCommand = program
  .command("snapshot")
  .description("Manage schema snapshots");

snapshotCommand
  .command("list")
  .description("List all snapshots")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(async (options) => {
    await snapshotListCommand(options);
  });

snapshotCommand
  .command("create")
  .description("Create a new snapshot")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-d, --description <description>", "Snapshot description")
  .option("--env <env>", "Environment", "development")
  .action(async (options) => {
    await snapshotCreateCommand(options);
  });

// Transition commands
const transitionCommand = program
  .command("transition")
  .description("Manage transitions between snapshots");

transitionCommand
  .command("create")
  .description("Create a transition between snapshots")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--from <hash>", "Source snapshot hash")
  .option("--to <hash>", "Target snapshot hash")
  .option("-d, --description <description>", "Transition description")
  .action(async (options) => {
    await transitionCreateCommand(options);
  });

// Resolve command
program
  .command("resolve")
  .description("Resolve schema merge conflicts")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--base <hash>", "Base snapshot hash")
  .option("--local <hash>", "Local snapshot hash")
  .option("--remote <hash>", "Remote snapshot hash")
  .action(async (options) => {
    await resolveCommand(options);
  });

// CI/CD commands
const ciCommand = program
  .command("ci")
  .description("CI/CD integration commands");

ciCommand
  .command("analyze")
  .description("Analyze schema changes for CI/CD")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("--from <hash>", "Source snapshot hash")
  .option("--to <hash>", "Target snapshot hash")
  .option("--output <format>", "Output format (json, text)", "text")
  .action(async (options) => {
    await ciAnalyzeCommand(options);
  });

ciCommand
  .command("validate")
  .description("Validate configuration")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(async (options) => {
    await ciValidateCommand(options);
  });

// MCP Server
program
  .command("mcp")
  .description("Start MCP (Model Context Protocol) server for AI assistants")
  .action(async () => {
    const { startMCPServer } = await import("./mcp/server.ts");
    await startMCPServer();
  });

program.parse();

