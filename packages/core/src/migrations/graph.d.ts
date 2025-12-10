import type { Transition } from "./transitions.js";
/**
 * Result of finding a path between two snapshots
 */
export interface PathResult {
    path: string[];
    transitions: Transition[];
    totalSteps: number;
}
/**
 * Transition graph (DAG) representation
 */
export interface TransitionGraph {
    nodes: Set<string>;
    edges: Map<string, Set<string>>;
    transitions: Map<string, Transition>;
}
/**
 * Get graph file path
 */
export declare function getGraphPath(configDir: string): string;
/**
 * Load transition graph from disk
 */
export declare function loadGraph(configDir: string): TransitionGraph;
/**
 * Build transition graph from snapshots and transitions
 */
export declare function buildGraph(configDir: string): TransitionGraph;
/**
 * Save transition graph to disk
 */
export declare function saveGraph(configDir: string, graph: TransitionGraph): void;
/**
 * Find shortest path between two snapshots using BFS
 */
export declare function findPath(configDir: string, fromHash: string, toHash: string): PathResult | null;
/**
 * Find reverse path (for rollback)
 */
export declare function findReversePath(configDir: string, fromHash: string, toHash: string): PathResult | null;
/**
 * Find all paths between two snapshots
 */
export declare function findAllPaths(configDir: string, fromHash: string, toHash: string): PathResult[];
/**
 * Get direct transition between two snapshots
 */
export declare function getDirectTransition(configDir: string, fromHash: string, toHash: string): Transition | null;
/**
 * Check if path exists between two snapshots
 */
export declare function pathExists(configDir: string, fromHash: string, toHash: string): boolean;
/**
 * Get all reachable snapshots from a given snapshot
 */
export declare function getReachableSnapshots(configDir: string, fromHash: string): string[];
/**
 * Get all predecessor snapshots (can reach this snapshot)
 */
export declare function getPredecessorSnapshots(configDir: string, toHash: string): string[];
