import { getFileSystem, getPathModule } from "../platform/fs.js";

const fs = () => getFileSystem();
const path = () => getPathModule();

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
export function getStateDir(configDir: string): string {
  return path().join(configDir, ".yama", "state");
}

/**
 * Get state file path for environment
 */
export function getStatePath(configDir: string, environment: string): string {
  return path().join(getStateDir(configDir), `${environment}.json`);
}

/**
 * Ensure state directory exists
 */
export function ensureStateDir(configDir: string): void {
  const stateDir = getStateDir(configDir);
  if (!fs().existsSync(stateDir)) {
    fs().mkdirSync(stateDir, { recursive: true });
  }
}

/**
 * Load state for environment
 */
export function loadState(configDir: string, environment: string): EnvironmentState | null {
  const statePath = getStatePath(configDir, environment);
  if (!fs().existsSync(statePath)) {
    return null;
  }
  
  try {
    const content = fs().readFileSync(statePath, "utf-8");
    return JSON.parse(content) as EnvironmentState;
  } catch {
    return null;
  }
}

/**
 * Save state for environment
 */
export function saveState(configDir: string, state: EnvironmentState): void {
  ensureStateDir(configDir);
  const statePath = getStatePath(configDir, state.environment);
  fs().writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Get or create state for environment
 */
export function getOrCreateState(configDir: string, environment: string): EnvironmentState {
  const existing = loadState(configDir, environment);
  if (existing) {
    return existing;
  }
  
  const newState: EnvironmentState = {
    environment,
    currentSnapshot: null,
    updatedAt: new Date().toISOString(),
  };
  saveState(configDir, newState);
  return newState;
}

/**
 * Update state with new snapshot
 */
export function updateState(configDir: string, environment: string, snapshotHash: string): void {
  const state = getOrCreateState(configDir, environment);
  state.currentSnapshot = snapshotHash;
  state.updatedAt = new Date().toISOString();
  saveState(configDir, state);
}

/**
 * Get current snapshot hash for environment
 */
export function getCurrentSnapshot(configDir: string, environment: string): string | null {
  const state = loadState(configDir, environment);
  return state?.currentSnapshot || null;
}

/**
 * Check if state exists for environment
 */
export function stateExists(configDir: string, environment: string): boolean {
  const statePath = getStatePath(configDir, environment);
  return fs().existsSync(statePath);
}

/**
 * Delete state for environment
 */
export function deleteState(configDir: string, environment: string): void {
  const statePath = getStatePath(configDir, environment);
  if (fs().existsSync(statePath) && fs().unlinkSync) {
    fs().unlinkSync!(statePath);
  }
}

/**
 * List all environments
 */
export function listEnvironments(configDir: string): string[] {
  const stateDir = getStateDir(configDir);
  if (!existsSync(stateDir)) {
    return [];
  }
  
  const fs = require("fs");
  const files = fs.readdirSync(stateDir);
  return files
    .filter((file: string) => file.endsWith(".json"))
    .map((file: string) => file.replace(".json", ""));
}

/**
 * Get all states
 */
export function getAllStates(configDir: string): EnvironmentState[] {
  const environments = listEnvironments(configDir);
  return environments
    .map(env => loadState(configDir, env))
    .filter((state): state is EnvironmentState => state !== null);
}
