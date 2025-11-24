import inquirer from "inquirer";
import type { MigrationStepUnion } from "@betagors/yama-core";
import { colors, printBox, printTable } from "./cli-utils.ts";

/**
 * Prompt for confirmation
 */
export async function confirm(message: string, defaultValue = false): Promise<boolean> {
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message,
      default: defaultValue,
    },
  ]);
  return confirmed;
}

/**
 * Prompt for migration confirmation with diff preview
 */
export async function confirmMigration(
  migrationName: string,
  steps: MigrationStepUnion[],
  hasDestructive: boolean
): Promise<boolean> {
  console.log("\n");
  printBox(
    `Migration: ${migrationName}\n\n` +
      `Steps: ${steps.length}\n` +
      `Destructive operations: ${hasDestructive ? "Yes" : "No"}`,
    hasDestructive ? { borderColor: "yellow" } : undefined
  );

  if (hasDestructive) {
    console.log(colors.warning("⚠️  This migration contains destructive operations!"));
  }

  // Show step summary
  const stepSummary = steps.map((step, index) => [
    `${index + 1}`,
    step.type,
    step.table,
    hasDestructiveOperation(step) ? "⚠️" : "✓",
  ]);

  printTable([["#", "Type", "Table", "Safe"], ...stepSummary]);

  return confirm("Apply this migration?", false);
}

/**
 * Check if a step is destructive
 */
export function hasDestructiveOperation(step: MigrationStepUnion): boolean {
  return (
    step.type === "drop_table" ||
    step.type === "drop_column" ||
    step.type === "drop_index" ||
    step.type === "drop_foreign_key" ||
    (step.type === "modify_column" && step.changes.nullable === false)
  );
}

/**
 * Prompt for migration name
 */
export async function promptMigrationName(suggestedName?: string): Promise<string> {
  const { name } = await inquirer.prompt([
    {
      type: "input",
      name: "name",
      message: "Migration name:",
      default: suggestedName || "migration",
      validate: (input: string) => {
        if (!input || input.trim().length === 0) {
          return "Migration name cannot be empty";
        }
        if (!/^[a-z0-9_-]+$/i.test(input)) {
          return "Migration name can only contain letters, numbers, underscores, and hyphens";
        }
        return true;
      },
    },
  ]);
  return name;
}

/**
 * Prompt for environment selection
 */
export async function promptEnvironment(environments: string[]): Promise<string> {
  if (environments.length === 0) {
    throw new Error("No environments configured");
  }

  if (environments.length === 1) {
    return environments[0];
  }

  const { env } = await inquirer.prompt([
    {
      type: "list",
      name: "env",
      message: "Select environment:",
      choices: environments,
      default: "local",
    },
  ]);
  return env;
}

/**
 * Multi-select for batch operations
 */
export async function selectMigrations(
  migrations: Array<{ name: string; description?: string }>
): Promise<string[]> {
  const { selected } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selected",
      message: "Select migrations to apply:",
      choices: migrations.map((m) => ({
        name: m.description ? `${m.name} - ${m.description}` : m.name,
        value: m.name,
      })),
    },
  ]);
  return selected;
}

