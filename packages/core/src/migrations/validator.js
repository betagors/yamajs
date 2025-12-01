/**
 * Validate migration YAML structure
 */
export function validateMigrationYAML(migration) {
    const errors = [];
    if (migration.type !== "schema") {
        errors.push({ message: "Invalid migration type" });
    }
    if (!migration.from_model?.hash) {
        errors.push({ message: "Missing from_model.hash", field: "from_model.hash" });
    }
    if (!migration.to_model?.hash) {
        errors.push({ message: "Missing to_model.hash", field: "to_model.hash" });
    }
    if (!Array.isArray(migration.steps)) {
        errors.push({ message: "Missing or invalid steps array", field: "steps" });
    }
    if (!migration.metadata) {
        errors.push({ message: "Missing metadata", field: "metadata" });
    }
    // Validate each step
    migration.steps.forEach((step, index) => {
        if (!step.type) {
            errors.push({ step: index, message: "Step missing type" });
        }
        if (!step.table) {
            errors.push({ step: index, message: "Step missing table", field: "table" });
        }
    });
    return errors;
}
/**
 * Validate that migration's from_model hash matches current model hash
 */
export function validateMigrationHash(migration, currentModel) {
    const errors = [];
    if (migration.from_model.hash !== currentModel.hash) {
        errors.push({
            message: `Migration from_model.hash (${migration.from_model.hash.substring(0, 8)}) does not match current model hash (${currentModel.hash.substring(0, 8)})`,
        });
    }
    return errors;
}
/**
 * Validate step dependencies
 */
export function validateStepDependencies(steps, currentModel) {
    const errors = [];
    const tables = new Set(currentModel.tables.keys());
    steps.forEach((step, index) => {
        // Check that referenced tables exist for column/index/FK operations
        if (step.type === "add_column" ||
            step.type === "drop_column" ||
            step.type === "modify_column" ||
            step.type === "add_index" ||
            step.type === "drop_index" ||
            step.type === "add_foreign_key" ||
            step.type === "drop_foreign_key") {
            // For add operations, table might be added in a previous step
            if (step.type.startsWith("add_")) {
                // Check if table exists in current model or was added earlier
                const wasAddedEarlier = steps
                    .slice(0, index)
                    .some((s) => s.type === "add_table" && s.table === step.table);
                if (!tables.has(step.table) && !wasAddedEarlier) {
                    errors.push({
                        step: index,
                        message: `Table ${step.table} does not exist and was not added in previous steps`,
                    });
                }
            }
            else {
                // For drop/modify operations, table must exist
                if (!tables.has(step.table)) {
                    errors.push({
                        step: index,
                        message: `Table ${step.table} does not exist`,
                    });
                }
            }
        }
        // For foreign keys, check that referenced table exists
        if (step.type === "add_foreign_key") {
            const refTable = step.foreignKey.references.table;
            const wasAddedEarlier = steps
                .slice(0, index)
                .some((s) => s.type === "add_table" && s.table === refTable);
            if (!tables.has(refTable) && !wasAddedEarlier) {
                errors.push({
                    step: index,
                    message: `Referenced table ${refTable} does not exist and was not added in previous steps`,
                });
            }
        }
    });
    return errors;
}
/**
 * Validate entire migration
 */
export function validateMigration(migration, currentModel) {
    const errors = [];
    // Validate structure
    errors.push(...validateMigrationYAML(migration));
    // Validate hash
    errors.push(...validateMigrationHash(migration, currentModel));
    // Validate dependencies
    errors.push(...validateStepDependencies(migration.steps, currentModel));
    return errors;
}
//# sourceMappingURL=validator.js.map