import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
/**
 * Get state directory path
 */
export function getStateDir(configDir) {
    return join(configDir, ".yama", "state");
}
/**
 * Get state file path for environment
 */
export function getStatePath(configDir, environment) {
    return join(getStateDir(configDir), `${environment}.json`);
}
/**
 * Ensure state directory exists
 */
export function ensureStateDir(configDir) {
    const stateDir = getStateDir(configDir);
    if (!existsSync(stateDir)) {
        mkdirSync(stateDir, { recursive: true });
    }
}
/**
 * Load state for environment
 */
export function loadState(configDir, environment) {
    const statePath = getStatePath(configDir, environment);
    if (!existsSync(statePath)) {
        return null;
    }
    try {
        const content = readFileSync(statePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
/**
 * Save state for environment
 */
export function saveState(configDir, state) {
    ensureStateDir(configDir);
    const statePath = getStatePath(configDir, state.environment);
    writeFileSync(statePath, JSON.stringify(state, null, 2), "utf-8");
}
/**
 * Get or create state for environment
 */
export function getOrCreateState(configDir, environment) {
    const existing = loadState(configDir, environment);
    if (existing) {
        return existing;
    }
    const newState = {
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
export function updateState(configDir, environment, snapshotHash) {
    const state = getOrCreateState(configDir, environment);
    state.currentSnapshot = snapshotHash;
    state.updatedAt = new Date().toISOString();
    saveState(configDir, state);
}
/**
 * Get current snapshot hash for environment
 */
export function getCurrentSnapshot(configDir, environment) {
    const state = loadState(configDir, environment);
    return state?.currentSnapshot || null;
}
/**
 * Check if state exists for environment
 */
export function stateExists(configDir, environment) {
    const statePath = getStatePath(configDir, environment);
    return existsSync(statePath);
}
/**
 * Delete state for environment
 */
export function deleteState(configDir, environment) {
    const statePath = getStatePath(configDir, environment);
    if (existsSync(statePath)) {
        const fs = require("fs");
        fs.unlinkSync(statePath);
    }
}
/**
 * List all environments
 */
export function listEnvironments(configDir) {
    const stateDir = getStateDir(configDir);
    if (!existsSync(stateDir)) {
        return [];
    }
    const fs = require("fs");
    const files = fs.readdirSync(stateDir);
    return files
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.replace(".json", ""));
}
/**
 * Get all states
 */
export function getAllStates(configDir) {
    const environments = listEnvironments(configDir);
    return environments
        .map(env => loadState(configDir, env))
        .filter((state) => state !== null);
}
//# sourceMappingURL=state.js.map