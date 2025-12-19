import { getRuntime } from "../platform/index.js";

const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

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
export async function ensureStateDir(configDir: string): Promise<void> {
  const stateDir = getStateDir(configDir);
  if (!await fs().exists(stateDir)) {
    await fs().mkdir(stateDir);
  }
}

/**
 * Load state for environment
 */
export async function loadState(configDir: string, environment: string): Promise<EnvironmentState | null> {
  const statePath = getStatePath(configDir, environment);
  if (!await fs().exists(statePath)) {
    return null;
  }

  try {
    const content = await fs().readTextFile(statePath);
    return JSON.parse(content) as EnvironmentState;
  } catch {
    return null;
  }
}

/**
 * Save state for environment
 */
export async function saveState(configDir: string, state: EnvironmentState): Promise<void> {
  await ensureStateDir(configDir);
  const statePath = getStatePath(configDir, state.environment);
  await fs().writeTextFile(statePath, JSON.stringify(state, null, 2));
}

/**
 * Get or create state for environment
 */
export async function getOrCreateState(configDir: string, environment: string): Promise<EnvironmentState> {
  const existing = await loadState(configDir, environment);
  if (existing) {
    return existing;
  }

  const newState: EnvironmentState = {
    environment,
    currentSnapshot: null,
    updatedAt: new Date().toISOString(),
  };
  await saveState(configDir, newState);
  return newState;
}

/**
 * Update state with new snapshot
 */
export async function updateState(configDir: string, environment: string, snapshotHash: string): Promise<void> {
  const state = await getOrCreateState(configDir, environment);
  state.currentSnapshot = snapshotHash;
  state.updatedAt = new Date().toISOString();
  await saveState(configDir, state);
}

/**
 * Get current snapshot hash for environment
 */
export async function getCurrentSnapshot(configDir: string, environment: string): Promise<string | null> {
  const state = await loadState(configDir, environment);
  return state?.currentSnapshot || null;
}

/**
 * Check if state exists for environment
 */
export async function stateExists(configDir: string, environment: string): Promise<boolean> {
  const statePath = getStatePath(configDir, environment);
  return fs().exists(statePath);
}

/**
 * Delete state for environment
 */
export async function deleteState(configDir: string, environment: string): Promise<void> {
  const statePath = getStatePath(configDir, environment);
  if (await fs().exists(statePath)) {
    await fs().remove(statePath);
  }
}

/**
 * List all environments
 */
export async function listEnvironments(configDir: string): Promise<string[]> {
  const stateDir = getStateDir(configDir);
  if (!await fs().exists(stateDir)) {
    return [];
  }

  const files = await fs().readDir(stateDir);
  return files
    .filter(file => file.isFile && file.name.endsWith(".json"))
    .map(file => file.name.replace(".json", ""));
}

/**
 * Get all states
 */
export async function getAllStates(configDir: string): Promise<EnvironmentState[]> {
  const environments = await listEnvironments(configDir);
  const states: EnvironmentState[] = [];
  for (const env of environments) {
    const state = await loadState(configDir, env);
    if (state) {
      states.push(state);
    }
  }
  return states;
}
