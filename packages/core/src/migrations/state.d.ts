/**
 * Environment state
 */
export interface EnvironmentState {
    environment: string;
    currentSnapshot: string | null;
    updatedAt: string;
}
/**
 * Get state directory path
 */
export declare function getStateDir(configDir: string): string;
/**
 * Get state file path for environment
 */
export declare function getStatePath(configDir: string, environment: string): string;
/**
 * Ensure state directory exists
 */
export declare function ensureStateDir(configDir: string): void;
/**
 * Load state for environment
 */
export declare function loadState(configDir: string, environment: string): EnvironmentState | null;
/**
 * Save state for environment
 */
export declare function saveState(configDir: string, state: EnvironmentState): void;
/**
 * Get or create state for environment
 */
export declare function getOrCreateState(configDir: string, environment: string): EnvironmentState;
/**
 * Update state with new snapshot
 */
export declare function updateState(configDir: string, environment: string, snapshotHash: string): void;
/**
 * Get current snapshot hash for environment
 */
export declare function getCurrentSnapshot(configDir: string, environment: string): string | null;
/**
 * Check if state exists for environment
 */
export declare function stateExists(configDir: string, environment: string): boolean;
/**
 * Delete state for environment
 */
export declare function deleteState(configDir: string, environment: string): void;
/**
 * List all environments
 */
export declare function listEnvironments(configDir: string): string[];
/**
 * Get all states
 */
export declare function getAllStates(configDir: string): EnvironmentState[];
