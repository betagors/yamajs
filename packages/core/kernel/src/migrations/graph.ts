import type { Transition } from "../../../../../../../../core/kernel/src/migrations/transitions.js";
import { getAllSnapshotHashes } from "../../../../../../../../core/kernel/src/migrations/snapshots.js";
import { getTransitionsDir, ensureTransitionsDir, getAllTransitions } from "../../../../../../../../core/kernel/src/migrations/transitions.js";
import { getRuntime } from "../../../../../../../../core/kernel/src/platform/index.js";

const fs = () => getRuntime().fs;
const path = () => getRuntime().path;

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
  nodes: Set<string>; // Snapshot hashes
  edges: Map<string, Set<string>>; // fromHash -> Set<toHash>
  transitions: Map<string, Transition>; // transitionHash -> Transition
}

/**
 * Get graph file path
 */
export function getGraphPath(configDir: string): string {
  return path().join(configDir, ".yama", "graph.json");
}

/**
 * Load transition graph from disk
 */
export async function loadGraph(configDir: string): Promise<TransitionGraph> {
  const graphPath = getGraphPath(configDir);

  if (!await fs().exists(graphPath)) {
    return buildGraph(configDir);
  }

  try {
    const content = await fs().readTextFile(graphPath);
    const data = JSON.parse(content) as {
      nodes: string[];
      edges: Record<string, string[]>;
      transitionHashes: string[];
    };

    const graph: TransitionGraph = {
      nodes: new Set(data.nodes),
      edges: new Map(),
      transitions: new Map(),
    };

    // Restore edges
    for (const [from, tos] of Object.entries(data.edges)) {
      graph.edges.set(from, new Set(tos));
    }

    // Load transitions
    const allTransitions = await getAllTransitions(configDir);
    for (const hash of data.transitionHashes) {
      try {
        const transition = allTransitions.find(t => t.hash === hash);
        if (transition) {
          graph.transitions.set(hash, transition);
        }
      } catch {
        // Transition file might be missing, skip it
      }
    }

    return graph;
  } catch {
    // If loading fails, rebuild
    return buildGraph(configDir);
  }
}

/**
 * Build transition graph from snapshots and transitions
 */
export async function buildGraph(configDir: string): Promise<TransitionGraph> {
  const graph: TransitionGraph = {
    nodes: new Set(),
    edges: new Map(),
    transitions: new Map(),
  };

  // Add all snapshots as nodes
  const snapshotHashes = await getAllSnapshotHashes(configDir);
  for (const hash of snapshotHashes) {
    graph.nodes.add(hash);
  }

  // Add transitions as edges
  const transitions = await getAllTransitions(configDir);
  for (const transition of transitions) {
    graph.nodes.add(transition.fromHash);
    graph.nodes.add(transition.toHash);

    if (!graph.edges.has(transition.fromHash)) {
      graph.edges.set(transition.fromHash, new Set());
    }
    graph.edges.get(transition.fromHash)!.add(transition.toHash);

    graph.transitions.set(transition.hash, transition);
  }

  // Save graph for future use
  await saveGraph(configDir, graph);

  return graph;
}

/**
 * Save transition graph to disk
 */
export async function saveGraph(configDir: string, graph: TransitionGraph): Promise<void> {
  await ensureTransitionsDir(configDir);
  const graphPath = getGraphPath(configDir);

  const data = {
    nodes: Array.from(graph.nodes),
    edges: Object.fromEntries(
      Array.from(graph.edges.entries()).map(([from, tos]) => [
        from,
        Array.from(tos),
      ])
    ),
    transitionHashes: Array.from(graph.transitions.keys()),
  };

  await fs().writeTextFile(graphPath, JSON.stringify(data, null, 2));
}

/**
 * Find shortest path between two snapshots using BFS
 */
export async function findPath(
  configDir: string,
  fromHash: string,
  toHash: string
): Promise<PathResult | null> {
  const graph = await loadGraph(configDir);

  if (!graph.nodes.has(fromHash) || !graph.nodes.has(toHash)) {
    return null;
  }

  if (fromHash === toHash) {
    return {
      path: [fromHash],
      transitions: [],
      totalSteps: 0,
    };
  }

  // BFS to find shortest path
  const queue: Array<{ hash: string; path: string[]; transitions: Transition[] }> = [
    { hash: fromHash, path: [fromHash], transitions: [] },
  ];
  const visited = new Set<string>([fromHash]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors = graph.edges.get(current.hash);
    if (!neighbors) {
      continue;
    }

    for (const neighborHash of neighbors) {
      if (neighborHash === toHash) {
        // Found target! Find the transition
        const transition = await findTransitionBetween(
          configDir,
          current.hash,
          neighborHash
        );
        if (transition) {
          return {
            path: [...current.path, neighborHash],
            transitions: [...current.transitions, transition],
            totalSteps: current.transitions.length + transition.steps.length,
          };
        }
      }

      if (!visited.has(neighborHash)) {
        visited.add(neighborHash);
        const transition = await findTransitionBetween(
          configDir,
          current.hash,
          neighborHash
        );
        if (transition) {
          queue.push({
            hash: neighborHash,
            path: [...current.path, neighborHash],
            transitions: [...current.transitions, transition],
          });
        }
      }
    }
  }

  return null; // No path found
}

/**
 * Find reverse path (for rollback)
 */
export async function findReversePath(
  configDir: string,
  fromHash: string,
  toHash: string
): Promise<PathResult | null> {
  const graph = await loadGraph(configDir);

  if (!graph.nodes.has(fromHash) || !graph.nodes.has(toHash)) {
    return null;
  }

  if (fromHash === toHash) {
    return {
      path: [fromHash],
      transitions: [],
      totalSteps: 0,
    };
  }

  // Build reverse edges map
  const reverseEdges = new Map<string, Set<string>>();
  for (const [from, tos] of graph.edges.entries()) {
    for (const to of tos) {
      if (!reverseEdges.has(to)) {
        reverseEdges.set(to, new Set());
      }
      reverseEdges.get(to)!.add(from);
    }
  }

  // BFS on reverse graph
  const queue: Array<{ hash: string; path: string[]; transitions: Transition[] }> = [
    { hash: fromHash, path: [fromHash], transitions: [] },
  ];
  const visited = new Set<string>([fromHash]);

  while (queue.length > 0) {
    const current = queue.shift()!;

    const neighbors = reverseEdges.get(current.hash);
    if (!neighbors) {
      continue;
    }

    for (const neighborHash of neighbors) {
      if (neighborHash === toHash) {
        // Found target! Find the transition (reversed)
        const transition = await findTransitionBetween(
          configDir,
          neighborHash,
          current.hash
        );
        if (transition) {
          return {
            path: [...current.path, neighborHash].reverse(),
            transitions: [transition, ...current.transitions].reverse(),
            totalSteps: current.transitions.length + transition.steps.length,
          };
        }
      }

      if (!visited.has(neighborHash)) {
        visited.add(neighborHash);
        const transition = await findTransitionBetween(
          configDir,
          neighborHash,
          current.hash
        );
        if (transition) {
          queue.push({
            hash: neighborHash,
            path: [...current.path, neighborHash],
            transitions: [transition, ...current.transitions],
          });
        }
      }
    }
  }

  return null; // No path found
}

/**
 * Find all paths between two snapshots
 */
export async function findAllPaths(
  configDir: string,
  fromHash: string,
  toHash: string
): Promise<PathResult[]> {
  const graph = await loadGraph(configDir);
  const paths: PathResult[] = [];

  if (!graph.nodes.has(fromHash) || !graph.nodes.has(toHash)) {
    return paths;
  }

  if (fromHash === toHash) {
    return [
      {
        path: [fromHash],
        transitions: [],
        totalSteps: 0,
      },
    ];
  }

  // DFS to find all paths
  async function dfs(
    current: string,
    target: string,
    path: string[],
    transitions: Transition[],
    visited: Set<string>
  ): Promise<void> {
    if (current === target) {
      paths.push({
        path: [...path],
        transitions: [...transitions],
        totalSteps: transitions.reduce((sum, t) => sum + t.steps.length, 0),
      });
      return;
    }

    const neighbors = graph.edges.get(current);
    if (!neighbors) {
      return;
    }

    for (const neighborHash of neighbors) {
      if (!visited.has(neighborHash)) {
        visited.add(neighborHash);
        const transition = await findTransitionBetween(configDir, current, neighborHash);
        if (transition) {
          await dfs(
            neighborHash,
            target,
            [...path, neighborHash],
            [...transitions, transition],
            visited
          );
        }
        visited.delete(neighborHash);
      }
    }
  }

  await dfs(fromHash, toHash, [fromHash], [], new Set([fromHash]));

  return paths;
}

/**
 * Get direct transition between two snapshots
 */
export async function getDirectTransition(
  configDir: string,
  fromHash: string,
  toHash: string
): Promise<Transition | null> {
  return findTransitionBetween(configDir, fromHash, toHash);
}

/**
 * Helper to find transition between two snapshots
 */
async function findTransitionBetween(
  configDir: string,
  fromHash: string,
  toHash: string
): Promise<Transition | null> {
  const transitions = await getAllTransitions(configDir);
  return (
    transitions.find(
      (t) => t.fromHash === fromHash && t.toHash === toHash
    ) || null
  );
}

/**
 * Check if path exists between two snapshots
 */
export async function pathExists(
  configDir: string,
  fromHash: string,
  toHash: string
): Promise<boolean> {
  return (await findPath(configDir, fromHash, toHash)) !== null;
}

/**
 * Get all reachable snapshots from a given snapshot
 */
export async function getReachableSnapshots(
  configDir: string,
  fromHash: string
): Promise<string[]> {
  const graph = await loadGraph(configDir);
  const reachable = new Set<string>();

  if (!graph.nodes.has(fromHash)) {
    return [];
  }

  // BFS to find all reachable nodes
  const queue = [fromHash];
  reachable.add(fromHash);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = graph.edges.get(current);
    if (!neighbors) {
      continue;
    }

    for (const neighborHash of neighbors) {
      if (!reachable.has(neighborHash)) {
        reachable.add(neighborHash);
        queue.push(neighborHash);
      }
    }
  }

  return Array.from(reachable);
}

/**
 * Get all predecessor snapshots (can reach this snapshot)
 */
export async function getPredecessorSnapshots(
  configDir: string,
  toHash: string
): Promise<string[]> {
  const graph = await loadGraph(configDir);
  const predecessors = new Set<string>();

  if (!graph.nodes.has(toHash)) {
    return [];
  }

  // Build reverse edges map
  const reverseEdges = new Map<string, Set<string>>();
  for (const [from, tos] of graph.edges.entries()) {
    for (const to of tos) {
      if (!reverseEdges.has(to)) {
        reverseEdges.set(to, new Set());
      }
      reverseEdges.get(to)!.add(from);
    }
  }

  // BFS on reverse graph
  const queue = [toHash];
  predecessors.add(toHash);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = reverseEdges.get(current);
    if (!neighbors) {
      continue;
    }

    for (const neighborHash of neighbors) {
      if (!predecessors.has(neighborHash)) {
        predecessors.add(neighborHash);
        queue.push(neighborHash);
      }
    }
  }

  return Array.from(predecessors);
}

/**
 * Graph pruning options
 */
export interface GraphPruneOptions {
  /** Remove snapshots older than this (e.g., "90d") */
  olderThan?: string;
  /** Snapshot hashes to always keep */
  keepSnapshots?: string[];
  /** Tags to protect (e.g., ["production", "staging"]) */
  keepTags?: string[];
  /** Only show what would be done */
  dryRun?: boolean;
}

/**
 * Graph pruning result
 */
export interface GraphPruneResult {
  /** Snapshots that were removed */
  removedSnapshots: string[];
  /** Transitions that were removed */
  removedTransitions: string[];
  /** Snapshots that were kept */
  keptSnapshots: string[];
  /** Whether this was a dry run */
  dryRun: boolean;
}

/**
 * Graph statistics
 */
export interface GraphStats {
  /** Total number of snapshots */
  snapshotCount: number;
  /** Total number of transitions */
  transitionCount: number;
  /** Oldest snapshot timestamp */
  oldestSnapshot: string | null;
  /** Newest snapshot timestamp */
  newestSnapshot: string | null;
  /** Number of orphaned transitions (referencing non-existent snapshots) */
  orphanedTransitions: number;
  /** Number of root nodes (nodes with no predecessors) */
  rootNodes: number;
  /** Number of leaf nodes (nodes with no successors) */
  leafNodes: number;
  /** Estimated graph size in bytes */
  estimatedSize: number;
}

/**
 * Parse duration string to milliseconds
 */
function parseDurationToMs(duration: string): number {
  const match = duration.match(/^(\d+)([dwmy])$/i);
  if (!match) return 90 * 24 * 60 * 60 * 1000; // Default 90 days

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const dayMs = 24 * 60 * 60 * 1000;

  switch (unit) {
    case "d": return value * dayMs;
    case "w": return value * 7 * dayMs;
    case "m": return value * 30 * dayMs;
    case "y": return value * 365 * dayMs;
    default: return value * dayMs;
  }
}

/**
 * Get graph statistics
 */
export async function getGraphStats(configDir: string): Promise<GraphStats> {
  const graph = await loadGraph(configDir);
  const transitions = await getAllTransitions(configDir);

  // Find orphaned transitions
  let orphanedCount = 0;
  for (const transition of transitions) {
    if (!graph.nodes.has(transition.fromHash) || !graph.nodes.has(transition.toHash)) {
      orphanedCount++;
    }
  }

  // Find root nodes (no incoming edges)
  const hasIncoming = new Set<string>();
  for (const targets of graph.edges.values()) {
    for (const target of targets) {
      hasIncoming.add(target);
    }
  }
  const rootNodes = Array.from(graph.nodes).filter(n => !hasIncoming.has(n));

  // Find leaf nodes (no outgoing edges)
  const leafNodes = Array.from(graph.nodes).filter(n => {
    const edges = graph.edges.get(n);
    return !edges || edges.size === 0;
  });

  // Get timestamps from transitions
  const timestamps = transitions
    .map(t => t.metadata?.createdAt)
    .filter((t): t is string => !!t)
    .sort();

  // Estimate size (rough calculation)
  const estimatedSize =
    graph.nodes.size * 100 + // ~100 bytes per node
    transitions.length * 500; // ~500 bytes per transition

  return {
    snapshotCount: graph.nodes.size,
    transitionCount: transitions.length,
    oldestSnapshot: timestamps[0] || null,
    newestSnapshot: timestamps[timestamps.length - 1] || null,
    orphanedTransitions: orphanedCount,
    rootNodes: rootNodes.length,
    leafNodes: leafNodes.length,
    estimatedSize,
  };
}

/**
 * Get snapshots that can be safely pruned
 */
export async function getPrunableSnapshots(
  configDir: string,
  options: GraphPruneOptions = {}
): Promise<string[]> {
  const graph = await loadGraph(configDir);
  const transitions = await getAllTransitions(configDir);
  const now = Date.now();

  // Build timestamp map
  const snapshotTimestamps = new Map<string, number>();
  for (const transition of transitions) {
    const timestamp = transition.metadata?.createdAt
      ? new Date(transition.metadata.createdAt).getTime()
      : now;

    // Use earliest appearance
    if (!snapshotTimestamps.has(transition.toHash) ||
      snapshotTimestamps.get(transition.toHash)! > timestamp) {
      snapshotTimestamps.set(transition.toHash, timestamp);
    }
  }

  const prunable: string[] = [];
  const olderThanMs = options.olderThan ? parseDurationToMs(options.olderThan) : null;

  for (const hash of graph.nodes) {
    // Skip if in keepSnapshots
    if (options.keepSnapshots?.includes(hash)) {
      continue;
    }

    // Skip if matches keepTags pattern (hash starts with tag)
    if (options.keepTags?.some(tag => hash.startsWith(tag))) {
      continue;
    }

    // Check age
    if (olderThanMs) {
      const timestamp = snapshotTimestamps.get(hash);
      if (timestamp && (now - timestamp) > olderThanMs) {
        prunable.push(hash);
      }
    }
  }

  return prunable;
}

/**
 * Get orphaned transitions (referencing non-existent snapshots)
 */
export async function getOrphanedTransitions(configDir: string): Promise<Transition[]> {
  const graph = await loadGraph(configDir);
  const transitions = await getAllTransitions(configDir);

  return transitions.filter(t =>
    !graph.nodes.has(t.fromHash) || !graph.nodes.has(t.toHash)
  );
}

/**
 * Prune old snapshots and orphaned transitions
 */
export async function pruneGraph(
  configDir: string,
  options: GraphPruneOptions = {}
): Promise<GraphPruneResult> {
  const result: GraphPruneResult = {
    removedSnapshots: [],
    removedTransitions: [],
    keptSnapshots: [],
    dryRun: options.dryRun ?? false,
  };

  const graph = await loadGraph(configDir);
  const prunable = await getPrunableSnapshots(configDir, options);

  // Calculate kept snapshots
  result.keptSnapshots = Array.from(graph.nodes).filter(h => !prunable.includes(h));

  if (!options.dryRun) {
    // Remove prunable snapshots
    for (const hash of prunable) {
      try {
        const snapshotPath = path().join(configDir, ".yama", "snapshots", `${hash}.json`);
        if (await fs().exists(snapshotPath)) {
          await fs().remove(snapshotPath);
        }
        graph.nodes.delete(hash);
        graph.edges.delete(hash);
        result.removedSnapshots.push(hash);
      } catch {
        // Ignore errors
      }
    }

    // Remove orphaned transitions
    const orphaned = await getOrphanedTransitions(configDir);
    for (const transition of orphaned) {
      try {
        const transitionPath = path().join(
          getTransitionsDir(configDir),
          `${transition.hash}.json`
        );
        if (await fs().exists(transitionPath)) {
          await fs().remove(transitionPath);
        }
        graph.transitions.delete(transition.hash);
        result.removedTransitions.push(transition.hash);
      } catch {
        // Ignore errors
      }
    }

    // Save updated graph
    await saveGraph(configDir, graph);
  } else {
    // Dry run - just report what would be removed
    result.removedSnapshots = prunable;
    result.removedTransitions = (await getOrphanedTransitions(configDir)).map(t => t.hash);
  }

  return result;
}

/**
 * Format graph statistics for CLI display
 */
export function formatGraphStats(stats: GraphStats): string {
  const lines: string[] = [];

  lines.push("📊 Migration Graph Statistics\n");
  lines.push(`   Snapshots:    ${stats.snapshotCount}`);
  lines.push(`   Transitions:  ${stats.transitionCount}`);
  lines.push(`   Root nodes:   ${stats.rootNodes}`);
  lines.push(`   Leaf nodes:   ${stats.leafNodes}`);

  if (stats.orphanedTransitions > 0) {
    lines.push(`   ⚠️ Orphaned:   ${stats.orphanedTransitions}`);
  }

  lines.push("");

  if (stats.oldestSnapshot) {
    lines.push(`   Oldest: ${stats.oldestSnapshot}`);
  }
  if (stats.newestSnapshot) {
    lines.push(`   Newest: ${stats.newestSnapshot}`);
  }

  const sizeKB = Math.round(stats.estimatedSize / 1024);
  lines.push(`   Est. size: ${sizeKB} KB`);

  return lines.join("\n");
}

/**
 * Format prune result for CLI display
 */
export function formatPruneResult(result: GraphPruneResult): string {
  const lines: string[] = [];

  if (result.dryRun) {
    lines.push("🔍 DRY RUN - No actual changes made\n");
  }

  if (result.removedSnapshots.length > 0) {
    const verb = result.dryRun ? "Would remove" : "Removed";
    lines.push(`✅ ${verb} ${result.removedSnapshots.length} snapshot(s)`);
    if (result.removedSnapshots.length <= 10) {
      for (const hash of result.removedSnapshots) {
        lines.push(`   - ${hash.substring(0, 12)}...`);
      }
    }
    lines.push("");
  }

  if (result.removedTransitions.length > 0) {
    const verb = result.dryRun ? "Would remove" : "Removed";
    lines.push(`✅ ${verb} ${result.removedTransitions.length} orphaned transition(s)`);
    lines.push("");
  }

  lines.push(`📌 Kept ${result.keptSnapshots.length} snapshot(s)`);

  if (result.removedSnapshots.length === 0 && result.removedTransitions.length === 0) {
    lines.push("\n✅ Nothing to prune");
  }

  return lines.join("\n");
}















