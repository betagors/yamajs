import type { MigrationStepUnion } from "./diff.js";

// Re-export for convenience
export type { MigrationStepUnion } from "./diff.js";

/**
 * Migration YAML structure
 */
export interface MigrationYAML {
  type: "schema";
  from_model: {
    hash: string;
  };
  to_model: {
    hash: string;
  };
  steps: MigrationStepUnion[];
  metadata: {
    generated_at: string;
    generated_by: string;
    description?: string;
  };
}

/**
 * Serialize migration to YAML string
 */
export function serializeMigration(migration: MigrationYAML): string {
  const yaml: Record<string, unknown> = {
    type: migration.type,
    from_model: migration.from_model,
    to_model: migration.to_model,
    steps: migration.steps,
    metadata: migration.metadata,
  };

  // Convert to YAML-like structure (we'll use JSON for now, can switch to js-yaml later)
  return JSON.stringify(yaml, null, 2);
}

/**
 * Deserialize migration from YAML/JSON string
 */
export function deserializeMigration(content: string): MigrationYAML {
  const parsed = JSON.parse(content);
  
  // Validate structure
  if (!parsed.type || parsed.type !== "schema") {
    throw new Error("Invalid migration type");
  }
  if (!parsed.from_model || parsed.from_model.hash === undefined) {
    throw new Error("Missing from_model.hash");
  }
  if (!parsed.to_model || !parsed.to_model.hash) {
    throw new Error("Missing to_model.hash");
  }
  if (!Array.isArray(parsed.steps)) {
    throw new Error("Missing or invalid steps array");
  }
  if (!parsed.metadata) {
    throw new Error("Missing metadata");
  }

  return parsed as MigrationYAML;
}

/**
 * Create a new migration YAML
 */
export function createMigration(
  fromHash: string,
  toHash: string,
  steps: MigrationStepUnion[],
  description?: string
): MigrationYAML {
  return {
    type: "schema",
    from_model: {
      hash: fromHash,
    },
    to_model: {
      hash: toHash,
    },
    steps,
    metadata: {
      generated_at: new Date().toISOString(),
      generated_by: "yama-cli",
      description,
    },
  };
}

