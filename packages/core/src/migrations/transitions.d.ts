import type { MigrationStepUnion } from "./diff.js";
/**
 * Transition metadata
 */
export interface TransitionMetadata {
    description?: string;
    createdAt: string;
}
/**
 * Transition represents a migration path between two snapshots
 */
export interface Transition {
    hash: string;
    fromHash: string;
    toHash: string;
    steps: MigrationStepUnion[];
    metadata: TransitionMetadata;
}
/**
 * Get transitions directory path
 */
export declare function getTransitionsDir(configDir: string): string;
/**
 * Get transition file path
 */
export declare function getTransitionPath(configDir: string, hash: string): string;
/**
 * Ensure transitions directory exists
 */
export declare function ensureTransitionsDir(configDir: string): void;
/**
 * Create a transition between two snapshots
 */
export declare function createTransition(fromHash: string, toHash: string, steps: MigrationStepUnion[], metadata: TransitionMetadata): Transition;
/**
 * Save transition to disk
 */
export declare function saveTransition(configDir: string, transition: Transition): void;
/**
 * Load transition from disk
 */
export declare function loadTransition(configDir: string, hash: string): Transition;
/**
 * Check if transition exists
 */
export declare function transitionExists(configDir: string, hash: string): boolean;
/**
 * Delete transition
 */
export declare function deleteTransition(configDir: string, hash: string): void;
/**
 * Get all transitions
 */
export declare function getAllTransitions(configDir: string): Transition[];
