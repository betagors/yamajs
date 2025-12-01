import yaml from "js-yaml";
/**
 * Serialize migration to YAML string
 */
export function serializeMigration(migration) {
    const data = {
        type: migration.type,
        from_model: migration.from_model,
        to_model: migration.to_model,
        steps: migration.steps,
        metadata: migration.metadata,
    };
    return yaml.dump(data, {
        indent: 2,
        lineWidth: -1, // No line wrapping
        quotingType: '"',
        forceQuotes: false,
    });
}
/**
 * Deserialize migration from YAML/JSON string
 * Supports both YAML and JSON formats for backward compatibility
 */
export function deserializeMigration(content) {
    let parsed;
    // Try to parse as YAML first (handles both YAML and JSON since JSON is valid YAML)
    try {
        parsed = yaml.load(content);
    }
    catch (err) {
        // Fallback to JSON.parse for backward compatibility with old JSON-only files
        try {
            parsed = JSON.parse(content);
        }
        catch (jsonErr) {
            throw new Error(`Failed to parse migration file: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    // Validate structure
    if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid migration format: expected object");
    }
    const migration = parsed;
    if (!migration.type || migration.type !== "schema") {
        throw new Error("Invalid migration type");
    }
    if (!migration.from_model || typeof migration.from_model !== "object") {
        throw new Error("Missing or invalid from_model");
    }
    if (!("hash" in migration.from_model) ||
        migration.from_model.hash === undefined) {
        throw new Error("Missing from_model.hash");
    }
    if (!migration.to_model || typeof migration.to_model !== "object") {
        throw new Error("Missing or invalid to_model");
    }
    if (!("hash" in migration.to_model) ||
        !migration.to_model.hash) {
        throw new Error("Missing to_model.hash");
    }
    if (!Array.isArray(migration.steps)) {
        throw new Error("Missing or invalid steps array");
    }
    if (!migration.metadata) {
        throw new Error("Missing metadata");
    }
    return parsed;
}
/**
 * Create a new migration YAML
 */
export function createMigration(fromHash, toHash, steps, description) {
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
            generated_by: "@betagors/yama-cli",
            description,
        },
    };
}
//# sourceMappingURL=migration-yaml.js.map