import type { YamaPlugin, PluginManifest, ServicePlugin } from "./base.js";

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
 * @deprecated Use validateYamaPlugin instead
 * Validate service plugin interface (kept for backward compatibility)
 */
export function validateServicePlugin(plugin: unknown): ValidationResult {
  const errors: string[] = [];

  if (!plugin || typeof plugin !== "object") {
    return {
      valid: false,
      errors: ["Plugin must be an object"],
    };
  }

  const p = plugin as Partial<ServicePlugin>;

  if (!p.name || typeof p.name !== "string") {
    errors.push("Plugin must have a name property (string)");
  }

  if (!p.version || typeof p.version !== "string") {
    errors.push("Plugin must have a version property (string)");
  }

  if (!p.manifest || typeof p.manifest !== "object") {
    errors.push("Plugin must have a manifest property (object)");
  } else {
    const manifestResult = validateManifest(p.manifest);
    if (!manifestResult.valid && manifestResult.errors) {
      errors.push(...manifestResult.errors.map((e) => `Manifest: ${e}`));
    }
  }

  if (!p.init || typeof p.init !== "function") {
    errors.push("Plugin must implement init() method");
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Validate plugin version compatibility
 */
export function validatePluginVersion(
  plugin: YamaPlugin | ServicePlugin,
  coreVersion: string
): ValidationResult {
  // Simple semver check - in a real implementation, use a semver library
  const errors: string[] = [];

  // Check yamaCore if available (optional but recommended)
  const yamaCore = (plugin as YamaPlugin).yamaCore || ((plugin as ServicePlugin).manifest?.yamaCore);
  if (!yamaCore) {
    // Warning only, not an error
    return {
      valid: true,
      errors: ["Plugin missing yamaCore compatibility version (recommended)"],
    };
  }

  // TODO: Implement proper semver range checking
  // This would require a semver library like semver

  return {
    valid: true,
  };
}

