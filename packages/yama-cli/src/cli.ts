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
import { migrateCommand } from "./commands/migrate.js";
import { migrateApplyCommand } from "./commands/migrate-apply.js";
import { migrateStatusCommand } from "./commands/migrate-status.js";

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

// Database migrations
program
  .command("db:migrate")
  .description("Generate database migration from entities")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .option("-n, --name <name>", "Migration name", "migration")
  .action(migrateCommand);

program
  .command("db:migrate:apply")
  .description("Apply pending database migrations")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(migrateApplyCommand);

program
  .command("db:migrate:status")
  .description("Check database migration status")
  .option("-c, --config <path>", "Path to yama.yaml", "yama.yaml")
  .action(migrateStatusCommand);

program.parse();

