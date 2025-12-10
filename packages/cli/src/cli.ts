#!/usr/bin/env node
import { Command } from "commander";
import type { PluginCLICommand } from "@betagors/yama-core";
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
import { schemaHistoryCommand } from "./commands/schema-history.ts";
import { schemaRestoreCommand } from "./commands/schema-restore.ts";
import { pluginListCommand, pluginInstallCommand, pluginValidateCommand } from "./commands/plugin.ts";
import { pluginMigrateCommand } from "./commands/plugin-migrate.ts";
import { pluginRollbackCommand } from "./commands/plugin-rollback.ts";
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
import { shadowsListCommand, shadowsRestoreCommand, shadowsCleanupCommand } from "./commands/shadows.ts";
import { backupsListCommand, backupsStatusCommand, backupsCleanupCommand } from "./commands/backups.ts";
import { deployCommand } from "./commands/deploy.ts";
import { rollbackCommand } from "./commands/rollback.ts";

const program = new Command();

program
  .name("yama")
  .description("Yama - Backend as Config")
  .version("0.1.0");

// ============================================================================
// CORE COMMANDS
// ============================================================================

program
  .command("create")
  .alias("new")
  .description("Create a new Yama project")
  .argument("[name]", "Project name or '.' for current directory")
  .option("--database <type>", "Database (postgresql, none)")
  .option("-y, --yes", "Use defaults")
  .action(createCommand);

program
  .command("dev")
  .description("Start dev server with hot reload")
  .option("-p, --port <port>", "Port", "4000")
  .option("--no-watch", "Disable watch mode")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action(devCommand);

program
  .command("generate")
  .alias("gen")
  .description("Generate SDK and types")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("-o, --output <path>", "Output path")
  .option("--types-only", "Types only")
  .option("--sdk-only", "SDK only")
   .option("--ir <path>", "Emit IR JSON to file")
  .action(generateCommand);

// ============================================================================
// SCHEMA & MIGRATIONS (Snapshot/Transition based)
// ============================================================================

program
  .command("status")
  .description("Show schema status")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .option("--short", "Short output")
  .action(schemaStatusCommand);

program
  .command("history")
  .description("Show migration history")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .option("--graph", "Show graph view")
  .action(schemaHistoryCommand);

program
  .command("deploy")
  .description("Deploy schema to environment")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .requiredOption("--env <env>", "Target environment")
  .option("--plan", "Show plan only")
  .option("--dry-run", "Dry run")
  .option("--auto-rollback", "Auto rollback on failure")
  .action(deployCommand);

program
  .command("rollback")
  .description("Rollback schema changes")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .requiredOption("--env <env>", "Environment")
  .option("--to <hash>", "Target snapshot")
  .option("--emergency", "Emergency mode")
  .action(rollbackCommand);

program
  .command("resolve")
  .description("Resolve schema merge conflicts")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--base <hash>", "Base snapshot")
  .option("--local <hash>", "Local snapshot")
  .option("--remote <hash>", "Remote snapshot")
  .action(resolveCommand);

// Snapshot subcommands
const snapshotCmd = program.command("snapshot").description("Manage snapshots");

snapshotCmd
  .command("list")
  .description("List snapshots")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(snapshotListCommand);

snapshotCmd
  .command("create")
  .description("Create snapshot")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("-d, --description <desc>", "Description")
  .option("--env <env>", "Environment", "development")
  .action(snapshotCreateCommand);

// Transition subcommands
const transitionCmd = program.command("transition").description("Manage transitions");

transitionCmd
  .command("create")
  .description("Create transition")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--from <hash>", "From snapshot")
  .option("--to <hash>", "To snapshot")
  .option("-d, --description <desc>", "Description")
  .action(transitionCreateCommand);

// Legacy migration aliases (pointing to new system)
program
  .command("migration:generate")
  .description("Generate migration (alias for schema changes)")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("-n, --name <name>", "Migration name")
  .option("--preview", "Preview only")
  .action(schemaGenerateCommand);

program
  .command("migration:apply")
  .description("Apply migrations (alias for deploy)")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .option("--no-apply", "Preview only")
  .option("--allow-destructive", "Allow destructive")
  .action(schemaApplyCommand);

program
  .command("migration:status")
  .description("Migration status (alias for status)")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .option("--short", "Short output")
  .action(schemaStatusCommand);

program
  .command("migration:check")
  .description("Check schema sync")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .option("--diff", "Show diff")
  .option("--ci", "CI mode")
  .action(schemaCheckCommand);

program
  .command("migration:history")
  .description("Migration history (alias for history)")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .option("--graph", "Graph view")
  .action(schemaHistoryCommand);

// ============================================================================
// SAFETY & RECOVERY
// ============================================================================

const shadowsCmd = program.command("shadows").description("Shadow columns");

shadowsCmd
  .command("list")
  .description("List shadow columns")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--table <table>", "Filter by table")
  .option("--expired", "Show expired only")
  .action(shadowsListCommand);

shadowsCmd
  .command("restore")
  .description("Restore shadow column")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .requiredOption("--table <table>", "Table")
  .requiredOption("--column <col>", "Column")
  .action(shadowsRestoreCommand);

shadowsCmd
  .command("cleanup")
  .description("Cleanup expired shadows")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--expired", "Expired only")
  .action(shadowsCleanupCommand);

const backupsCmd = program.command("backups").description("Database backups");

backupsCmd
  .command("list")
  .description("List backups")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--snapshot <hash>", "Filter by snapshot")
  .action(backupsListCommand);

backupsCmd
  .command("status")
  .description("Backup status")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(backupsStatusCommand);

backupsCmd
  .command("cleanup")
  .description("Cleanup old backups")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--older-than <days>", "Older than N days")
  .action(backupsCleanupCommand);

program
  .command("schema:restore")
  .description("Restore from data snapshot")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--list", "List snapshots")
  .option("--snapshot <name>", "Snapshot name")
  .option("--table <table>", "Table")
  .action(schemaRestoreCommand);

// ============================================================================
// VALIDATION & INSPECTION
// ============================================================================

program
  .command("validate")
  .description("Validate configuration")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--strict", "Strict mode")
  .action(validateCommand);

program
  .command("config")
  .description("Show configuration")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(configCommand);

program
  .command("endpoints")
  .description("List endpoints")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(endpointsCommand);

program
  .command("schemas")
  .description("List schemas")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(schemasCommand);

program
  .command("docs")
  .description("Generate API docs")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("-f, --format <fmt>", "Format (openapi, json, yaml, html, md)", "openapi")
  .option("-o, --output <path>", "Output path")
  .action(docsCommand);

// ============================================================================
// DATABASE INSPECTION
// ============================================================================

const dbCmd = program.command("db").description("Database tools");

dbCmd
  .command("list")
  .description("List tables")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action(dbListCommand);

dbCmd
  .command("inspect")
  .description("Inspect table")
  .argument("<table>", "Table name")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action(dbInspectCommand);

// ============================================================================
// ADD COMMANDS
// ============================================================================

program
  .command("add")
  .description("Add endpoint, schema, or entity")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("-t, --type <type>", "Type (endpoint, schema, entity)")
  .action(addCommand);

program
  .command("add:endpoint")
  .alias("add-endpoint")
  .description("Add endpoint")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(addEndpointCommand);

program
  .command("add:schema")
  .alias("add-schema")
  .description("Add schema")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(addSchemaCommand);

program
  .command("add:entity")
  .alias("add-entity")
  .description("Add entity")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(addEntityCommand);

program
  .command("add:handler")
  .alias("add-handler")
  .description("Add handler")
  .requiredOption("-n, --name <name>", "Handler name")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("-f, --force", "Overwrite")
  .action(addHandlerCommand);

program
  .command("add:plugin")
  .alias("add-plugin")
  .description("Add plugin")
  .requiredOption("-n, --name <name>", "Plugin name")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--config-only", "Config only")
  .action(addPluginCommand);

program
  .command("remove:plugin")
  .alias("remove-plugin")
  .description("Remove plugin")
  .requiredOption("-n, --name <name>", "Plugin name")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--keep-package", "Keep package")
  .action(removePluginCommand);

program
  .command("sync:plugins")
  .alias("sync-plugins")
  .description("Sync plugins")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--remove", "Remove extras")
  .action(syncPluginsCommand);

// ============================================================================
// PLUGIN MANAGEMENT
// ============================================================================

const pluginCmd = program.command("plugin").description("Plugin management");

pluginCmd.command("list").description("List plugins").action(pluginListCommand);
pluginCmd.command("install").description("Install plugin").argument("<pkg>", "Package").action((pkg) => pluginInstallCommand({ package: pkg }));
pluginCmd.command("validate").description("Validate plugins").action(pluginValidateCommand);

pluginCmd
  .command("migrate")
  .description("Run plugin migrations")
  .option("--plugin <name>", "Plugin name")
  .option("--all", "All plugins")
  .option("--dry-run", "Dry run")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action(pluginMigrateCommand);

pluginCmd
  .command("rollback")
  .description("Rollback plugin")
  .argument("[plugin]", "Plugin")
  .option("--to-version <ver>", "Version")
  .option("--steps <n>", "Steps")
  .option("--dry-run", "Dry run")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action((plugin, opts) => {
    if (!plugin) {
      console.error("Plugin name required");
      process.exit(1);
    }
    if (!opts.toVersion && !opts.steps) {
      console.error("--to-version or --steps required");
      process.exit(1);
    }
    if (opts.steps) opts.steps = parseInt(opts.steps, 10);
    pluginRollbackCommand(plugin, opts);
  });

pluginCmd
  .command("status")
  .description("Plugin status")
  .option("--plugin <name>", "Plugin")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action(pluginStatusCommand);

pluginCmd
  .command("health")
  .description("Plugin health")
  .option("--plugin <name>", "Plugin")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .action(pluginHealthCommand);

pluginCmd
  .command("search")
  .description("Search plugins")
  .argument("<query>", "Query")
  .option("--category <cat>", "Category")
  .option("--limit <n>", "Limit", "20")
  .action((query, opts) => pluginSearchCommand({ query, ...opts }));

pluginCmd
  .command("info")
  .description("Plugin info")
  .argument("<pkg>", "Package")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action((pkg, opts) => pluginInfoCommand({ package: pkg, ...opts }));

pluginCmd
  .command("docs")
  .description("Plugin docs")
  .argument("<pkg>", "Package")
  .option("--format <fmt>", "Format (markdown, html)", "markdown")
  .option("-o, --output <path>", "Output")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action((pkg, opts) => pluginDocsCommand({ package: pkg, ...opts }));

pluginCmd
  .command("metrics")
  .description("Plugin metrics")
  .option("--plugin <name>", "Plugin")
  .option("--reset", "Reset")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--env <env>", "Environment", "development")
  .option("--format <fmt>", "Format (table, prometheus, json)", "table")
  .action(pluginMetricsCommand);

// ============================================================================
// CI/CD
// ============================================================================

const ciCmd = program.command("ci").description("CI/CD commands");

ciCmd
  .command("analyze")
  .description("Analyze changes")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .option("--from <hash>", "From")
  .option("--to <hash>", "To")
  .option("--output <fmt>", "Output (json, text)", "text")
  .action(ciAnalyzeCommand);

ciCmd
  .command("validate")
  .description("Validate config")
  .option("-c, --config <path>", "Config path", "yama.yaml")
  .action(ciValidateCommand);

// ============================================================================
// MCP SERVER
// ============================================================================

program
  .command("mcp")
  .description("Start MCP server")
  .action(async () => {
    const { startMCPServer } = await import("./mcp/server.ts");
    await startMCPServer();
  });

// ============================================================================
// PLUGIN COMMANDS REGISTRATION
// ============================================================================

async function registerPluginCommands() {
  const { loadPluginCommands } = await import("./utils/plugin-commands.ts");
  const commands = await loadPluginCommands();
  
  const commandGroups = new Map<string, PluginCLICommand[]>();
  
  for (const command of commands) {
    const parts = command.name.split(" ");
    const groupName = parts[0];
    if (!commandGroups.has(groupName)) {
      commandGroups.set(groupName, []);
    }
    commandGroups.get(groupName)!.push(command);
  }
  
  for (const [groupName, groupCommands] of commandGroups.entries()) {
    const groupCommand = program.command(groupName).description(`${groupName} plugin`);
    
    for (const cmd of groupCommands) {
      const parts = cmd.name.split(" ");
      const subcommandName = parts.slice(1).join(" ") || groupName;
      
      const subcommand = groupCommand.command(subcommandName).description(cmd.description);
      
      if (cmd.options) {
        for (const option of cmd.options) {
          if (option.required) {
            subcommand.requiredOption(option.flags, option.description, option.defaultValue);
          } else {
            subcommand.option(option.flags, option.description, option.defaultValue);
          }
        }
      }
      
      subcommand.action(async (options) => {
        try {
          await cmd.action(options);
        } catch (error) {
          console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
          process.exit(1);
        }
      });
    }
  }
}

// Parse
(async () => {
  await registerPluginCommands();
  program.parse();
})();
