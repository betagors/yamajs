import { execSync } from "child_process";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Get current git branch name
 */
export function getCurrentBranch(): string | null {
  try {
    return execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if we're in a git repository
 */
export function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --git-dir", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate migration name from git branch
 */
export function generateMigrationNameFromBranch(branch?: string | null): string {
  const currentBranch = branch || getCurrentBranch();
  
  if (!currentBranch) {
    return "migration";
  }

  // Remove common prefixes
  let name = currentBranch
    .replace(/^(feature|fix|bugfix|hotfix)\//i, "")
    .replace(/[^a-z0-9-]/gi, "_")
    .toLowerCase();

  // Limit length
  if (name.length > 50) {
    name = name.substring(0, 50);
  }

  return name || "migration";
}

/**
 * Check if there are uncommitted migration files
 */
export function hasUncommittedMigrations(migrationsDir: string): boolean {
  if (!isGitRepo() || !existsSync(migrationsDir)) {
    return false;
  }

  try {
    const result = execSync(
      `git status --porcelain ${migrationsDir}`,
      { encoding: "utf-8" }
    );
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get uncommitted migration files
 */
export function getUncommittedMigrations(migrationsDir: string): string[] {
  if (!isGitRepo() || !existsSync(migrationsDir)) {
    return [];
  }

  try {
    const result = execSync(
      `git status --porcelain ${migrationsDir}`,
      { encoding: "utf-8" }
    );
    return result
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => line.split(/\s+/).pop() || "")
      .filter((file) => file.endsWith(".yaml") || file.endsWith(".sql"));
  } catch {
    return [];
  }
}

/**
 * Check for migration conflicts in git
 */
export function hasMigrationConflicts(migrationsDir: string): boolean {
  if (!isGitRepo() || !existsSync(migrationsDir)) {
    return false;
  }

  try {
    // Check for merge conflicts
    const result = execSync(
      `git diff --check ${migrationsDir}`,
      { encoding: "utf-8", stdio: "pipe" }
    );
    return result.includes("<<<<<<<");
  } catch {
    // If command fails, assume no conflicts
    return false;
  }
}

/**
 * Install pre-commit hook
 */
export function installPreCommitHook(): boolean {
  if (!isGitRepo()) {
    return false;
  }

  const hooksDir = join(".git", "hooks");
  const hookPath = join(hooksDir, "pre-commit");

  if (!existsSync(hooksDir)) {
    return false;
  }

  const hookContent = `#!/bin/sh
# Yama migration check pre-commit hook
yama migration:check --ci
if [ $? -ne 0 ]; then
  echo "❌ Migration check failed. Please run 'yama migration:check' to see details."
  exit 1
fi
`;

  try {
    require("fs").writeFileSync(hookPath, hookContent, { mode: 0o755 });
    return true;
  } catch {
    return false;
  }
}

