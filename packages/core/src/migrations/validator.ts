import type { MigrationStepUnion } from "./diff.js";
import type { Model } from "./model.js";
import type { Transition } from "./transitions.js";

/**
 * Validation error
 */
export interface ValidationError {
  step?: number;
  message: string;
  field?: string;
}

/**
 * Validate that transition's fromHash matches current model hash
 */
export function validateMigrationHash(
  transition: Transition,
  currentModel: Model
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (transition.fromHash !== currentModel.hash) {
    errors.push({
      message: `Transition fromHash (${transition.fromHash.substring(0, 8)}) does not match current model hash (${currentModel.hash.substring(0, 8)})`,
    });
  }

  return errors;
}

/**
 * Validate step dependencies
 */
export function validateStepDependencies(
  steps: MigrationStepUnion[],
  currentModel: Model
): ValidationError[] {
  const errors: ValidationError[] = [];
  const tables = new Set(currentModel.tables.keys());

  steps.forEach((step, index) => {
    // Check that referenced tables exist for column/index/FK operations
    if (
      step.type === "add_column" ||
      step.type === "drop_column" ||
      step.type === "modify_column" ||
      step.type === "add_index" ||
      step.type === "drop_index" ||
      step.type === "add_foreign_key" ||
      step.type === "drop_foreign_key"
    ) {
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
      } else {
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
 * Validate a transition
 */
export function validateTransition(
  transition: Transition,
  currentModel: Model
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate hash
  errors.push(...validateMigrationHash(transition, currentModel));

  // Validate dependencies
  errors.push(...validateStepDependencies(transition.steps, currentModel));

  return errors;
}
