import semver from "semver";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import type { YamaPlugin, PluginManifest } from "./base.js";
import {
  validateSecurityPolicy,
  getSecurityWarnings,
} from "./security.js";
import { getFileSystem, getPathModule } from "../platform/fs.js";

// Create Ajv instance with formats
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

/**
 * Validate plugin manifest (all fields are optional now)
 */
export function validateManifest(manifest: PluginManifest): ValidationResult {
  // Manifest validation is now lenient - all fields are optional
  // This allows future-proof plugins that don't need all metadata
  return {
    valid: true,
  };
}

/**
 * Validate YamaPlugin interface
 */
export function validateYamaPlugin(plugin: unknown): ValidationResult {
  const errors: string[] = [];

  if (!plugin || typeof plugin !== "object") {
    return {
      valid: false,
      errors: ["Plugin must be an object"],
    };
  }

  const p = plugin as Partial<YamaPlugin>;

  // Name is required
  if (!p.name || typeof p.name !== "string") {
    errors.push("Plugin must have a name property (string)");
  }

  // Init method is required
  if (!p.init || typeof p.init !== "function") {
    errors.push("Plugin must implement init() method");
  }

  // Version, category, manifest are all optional but recommended
  // No validation errors for missing optional fields

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}


/**
 * Validate plugin version compatibility
 */
export function validatePluginVersion(
  plugin: YamaPlugin,
  coreVersion: string
): ValidationResult {
  const errors: string[] = [];

  // Check yamaCore if available (optional but recommended)
  const yamaCore = plugin.yamaCore;
  if (!yamaCore) {
    // Warning only, not an error
    return {
      valid: true,
      errors: ["Plugin missing yamaCore compatibility version (recommended)"],
    };
  }

  // Validate core version is valid semver
  if (!semver.valid(coreVersion)) {
    return {
      valid: false,
      errors: [`Invalid core version: ${coreVersion}`],
    };
  }

  // Use semver to check compatibility
  if (!semver.satisfies(coreVersion, yamaCore)) {
    return {
      valid: false,
      errors: [
        `Plugin requires yamaCore ${yamaCore}, but core is ${coreVersion}`,
      ],
    };
  }

  return {
    valid: true,
  };
}

/**
 * Validate plugin configuration against config schema
 */
export function validatePluginConfig(
  config: Record<string, unknown>,
  manifest: PluginManifest
): ValidationResult {
  const errors: string[] = [];

  if (!manifest.configSchema) {
    // No schema defined - config is valid
    return { valid: true };
  }

  try {
    const validate = ajv.compile(manifest.configSchema);
    const valid = validate(config);

    if (!valid && validate.errors) {
      for (const error of validate.errors) {
        const path = error.instancePath || error.schemaPath || "root";
        const message = error.message || "Invalid value";
        errors.push(`${path}: ${message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [
        `Invalid config schema: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

/**
 * Validate migration definitions in manifest
 */
export function validateMigrations(
  manifest: PluginManifest,
  pluginDir?: string
): ValidationResult {
  const fs = getFileSystem();
  const path = getPathModule();
  const errors: string[] = [];

  if (!manifest.migrations) {
    return { valid: true };
  }

  const migrations = manifest.migrations;

  // Validate each migration version is valid semver
  for (const [version, migration] of Object.entries(migrations)) {
    if (!semver.valid(version)) {
      errors.push(
        `Invalid migration version "${version}" - must be valid semver (e.g., "1.0.0")`
      );
      continue;
    }

    // Validate migration structure
    if (!migration.up) {
      errors.push(`Migration ${version} missing "up" script`);
      continue;
    }

    // If up is a string (file path), check if file exists (if pluginDir provided)
    if (typeof migration.up === "string" && pluginDir) {
      const filePath = path.join(pluginDir, migration.up);
      if (!fs.existsSync(filePath)) {
        errors.push(
          `Migration ${version} up file not found: ${filePath}`
        );
      }
    }

    // If down is a string (file path), check if file exists (if pluginDir provided)
    if (migration.down && typeof migration.down === "string" && pluginDir) {
      const filePath = path.join(pluginDir, migration.down);
      if (!fs.existsSync(filePath)) {
        errors.push(
          `Migration ${version} down file not found: ${filePath}`
        );
      }
    }

    // Validate migration type
    if (
      migration.type &&
      !["schema", "config", "data"].includes(migration.type)
    ) {
      errors.push(
        `Migration ${version} has invalid type "${migration.type}" - must be "schema", "config", or "data"`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

