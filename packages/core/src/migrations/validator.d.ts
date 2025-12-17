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
export declare function validateMigrationHash(transition: Transition, currentModel: Model): ValidationError[];
/**
 * Validate step dependencies
 */
export declare function validateStepDependencies(steps: MigrationStepUnion[], currentModel: Model): ValidationError[];
/**
 * Validate a transition
 */
export declare function validateTransition(transition: Transition, currentModel: Model): ValidationError[];
//# sourceMappingURL=validator.d.ts.map