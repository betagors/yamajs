import { getRuntime } from "../platform/index.js";
import { sha256Hex } from "../platform/hash.js";
import type { MigrationStepUnion } from "./diff.js";

const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

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
export function getTransitionsDir(configDir: string): string {
  return path().join(configDir, ".yama", "transitions");
}

/**
 * Get transition file path
 */
export function getTransitionPath(configDir: string, hash: string): string {
  return path().join(getTransitionsDir(configDir), `${hash}.json`);
}

/**
 * Ensure transitions directory exists
 */
export async function ensureTransitionsDir(configDir: string): Promise<void> {
  const transitionsDir = getTransitionsDir(configDir);
  if (!await fs().exists(transitionsDir)) {
    await fs().mkdir(transitionsDir);
  }
}

/**
 * Create a transition between two snapshots
 */
export async function createTransition(
  fromHash: string,
  toHash: string,
  steps: MigrationStepUnion[],
  metadata: TransitionMetadata
): Promise<Transition> {
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
export async function saveTransition(configDir: string, transition: Transition): Promise<void> {
  await ensureTransitionsDir(configDir);
  const transitionPath = getTransitionPath(configDir, transition.hash);
  await fs().writeTextFile(transitionPath, JSON.stringify(transition, null, 2));
}

/**
 * Load transition from disk
 */
export async function loadTransition(configDir: string, hash: string): Promise<Transition> {
  const transitionPath = getTransitionPath(configDir, hash);
  if (!await fs().exists(transitionPath)) {
    throw new Error(`Transition not found: ${hash}`);
  }

  const content = await fs().readTextFile(transitionPath);
  return JSON.parse(content) as Transition;
}

/**
 * Check if transition exists
 */
export async function transitionExists(configDir: string, hash: string): Promise<boolean> {
  const transitionPath = getTransitionPath(configDir, hash);
  return fs().exists(transitionPath);
}

/**
 * Delete transition
 */
export async function deleteTransition(configDir: string, hash: string): Promise<void> {
  const transitionPath = getTransitionPath(configDir, hash);
  if (await fs().exists(transitionPath)) {
    await fs().remove(transitionPath);
  }
}

/**
 * Get all transitions
 */
export async function getAllTransitions(configDir: string): Promise<Transition[]> {
  const transitionsDir = getTransitionsDir(configDir);
  if (!await fs().exists(transitionsDir)) {
    return [];
  }

  const files = await fs().readDir(transitionsDir);
  const transitions: Transition[] = [];

  for (const file of files) {
    if (file.isFile && file.name.endsWith(".json")) {
      try {
        const content = await fs().readTextFile(
          path().join(transitionsDir, file.name)
        );
        const transition = JSON.parse(content) as Transition;
        transitions.push(transition);
      } catch {
        // Skip invalid files
      }
    }
  }

  return transitions;
}

