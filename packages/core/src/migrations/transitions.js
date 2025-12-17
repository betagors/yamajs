import { getFileSystem, getPathModule } from "../platform/fs.js";
import { sha256Hex } from "../platform/hash.js";
const fs = () => getFileSystem();
const path = () => getPathModule();
/**
 * Get transitions directory path
 */
export function getTransitionsDir(configDir) {
    return path().join(configDir, ".yama", "transitions");
}
/**
 * Get transition file path
 */
export function getTransitionPath(configDir, hash) {
    return path().join(getTransitionsDir(configDir), `${hash}.json`);
}
/**
 * Ensure transitions directory exists
 */
export function ensureTransitionsDir(configDir) {
    const transitionsDir = getTransitionsDir(configDir);
    if (!fs().existsSync(transitionsDir)) {
        fs().mkdirSync(transitionsDir, { recursive: true });
    }
}
/**
 * Create a transition between two snapshots
 */
export function createTransition(fromHash, toHash, steps, metadata) {
    // Create hash from fromHash, toHash, and steps
    const transitionData = JSON.stringify({
        fromHash,
        toHash,
        steps,
    });
    const hash = sha256Hex(transitionData);
    return {
        hash,
        fromHash,
        toHash,
        steps,
        metadata,
    };
}
/**
 * Save transition to disk
 */
export function saveTransition(configDir, transition) {
    ensureTransitionsDir(configDir);
    const transitionPath = getTransitionPath(configDir, transition.hash);
    fs().writeFileSync(transitionPath, JSON.stringify(transition, null, 2), "utf-8");
}
/**
 * Load transition from disk
 */
export function loadTransition(configDir, hash) {
    const transitionPath = getTransitionPath(configDir, hash);
    if (!existsSync(transitionPath)) {
        throw new Error(`Transition not found: ${hash}`);
    }
    const content = readFileSync(transitionPath, "utf-8");
    return JSON.parse(content);
}
/**
 * Check if transition exists
 */
export function transitionExists(configDir, hash) {
    const transitionPath = getTransitionPath(configDir, hash);
    return existsSync(transitionPath);
}
/**
 * Delete transition
 */
export function deleteTransition(configDir, hash) {
    const transitionPath = getTransitionPath(configDir, hash);
    if (existsSync(transitionPath)) {
        const fs = require("fs");
        fs.unlinkSync(transitionPath);
    }
}
/**
 * Get all transitions
 */
export function getAllTransitions(configDir) {
    const transitionsDir = getTransitionsDir(configDir);
    if (!existsSync(transitionsDir)) {
        return [];
    }
    const fs = require("fs");
    const files = fs.readdirSync(transitionsDir);
    const transitions = [];
    for (const file of files) {
        if (file.endsWith(".json")) {
            try {
                const content = readFileSync(join(transitionsDir, file), "utf-8");
                const transition = JSON.parse(content);
                transitions.push(transition);
            }
            catch {
                // Skip invalid files
            }
        }
    }
    return transitions;
}
//# sourceMappingURL=transitions.js.map