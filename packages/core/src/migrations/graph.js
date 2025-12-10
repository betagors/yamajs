import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getAllSnapshotHashes } from "./snapshots.js";
import { ensureTransitionsDir, getAllTransitions } from "./transitions.js";
/**
 * Get graph file path
 */
export function getGraphPath(configDir) {
    return join(configDir, ".yama", "graph.json");
}
/**
 * Load transition graph from disk
 */
export function loadGraph(configDir) {
    const graphPath = getGraphPath(configDir);
    if (!existsSync(graphPath)) {
        return buildGraph(configDir);
    }
    try {
        const content = readFileSync(graphPath, "utf-8");
        const data = JSON.parse(content);
        const graph = {
            nodes: new Set(data.nodes),
            edges: new Map(),
            transitions: new Map(),
        };
        // Restore edges
        for (const [from, tos] of Object.entries(data.edges)) {
            graph.edges.set(from, new Set(tos));
        }
        // Load transitions
        for (const hash of data.transitionHashes) {
            try {
                const transition = getAllTransitions(configDir).find(t => t.hash === hash);
                if (transition) {
                    graph.transitions.set(hash, transition);
                }
            }
            catch {
                // Transition file might be missing, skip it
            }
        }
        return graph;
    }
    catch {
        // If loading fails, rebuild
        return buildGraph(configDir);
    }
}
/**
 * Build transition graph from snapshots and transitions
 */
export function buildGraph(configDir) {
    const graph = {
        nodes: new Set(),
        edges: new Map(),
        transitions: new Map(),
    };
    // Add all snapshots as nodes
    const snapshotHashes = getAllSnapshotHashes(configDir);
    for (const hash of snapshotHashes) {
        graph.nodes.add(hash);
    }
    // Add transitions as edges
    const transitions = getAllTransitions(configDir);
    for (const transition of transitions) {
        graph.nodes.add(transition.fromHash);
        graph.nodes.add(transition.toHash);
        if (!graph.edges.has(transition.fromHash)) {
            graph.edges.set(transition.fromHash, new Set());
        }
        graph.edges.get(transition.fromHash).add(transition.toHash);
        graph.transitions.set(transition.hash, transition);
    }
    // Save graph for future use
    saveGraph(configDir, graph);
    return graph;
}
/**
 * Save transition graph to disk
 */
export function saveGraph(configDir, graph) {
    ensureTransitionsDir(configDir);
    const graphPath = getGraphPath(configDir);
    const data = {
        nodes: Array.from(graph.nodes),
        edges: Object.fromEntries(Array.from(graph.edges.entries()).map(([from, tos]) => [
            from,
            Array.from(tos),
        ])),
        transitionHashes: Array.from(graph.transitions.keys()),
    };
    writeFileSync(graphPath, JSON.stringify(data, null, 2), "utf-8");
}
/**
 * Find shortest path between two snapshots using BFS
 */
export function findPath(configDir, fromHash, toHash) {
    const graph = loadGraph(configDir);
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
    const queue = [
        { hash: fromHash, path: [fromHash], transitions: [] },
    ];
    const visited = new Set([fromHash]);
    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = graph.edges.get(current.hash);
        if (!neighbors) {
            continue;
        }
        for (const neighborHash of neighbors) {
            if (neighborHash === toHash) {
                // Found target! Find the transition
                const transition = findTransitionBetween(configDir, current.hash, neighborHash);
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
                const transition = findTransitionBetween(configDir, current.hash, neighborHash);
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
export function findReversePath(configDir, fromHash, toHash) {
    const graph = loadGraph(configDir);
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
    const reverseEdges = new Map();
    for (const [from, tos] of graph.edges.entries()) {
        for (const to of tos) {
            if (!reverseEdges.has(to)) {
                reverseEdges.set(to, new Set());
            }
            reverseEdges.get(to).add(from);
        }
    }
    // BFS on reverse graph
    const queue = [
        { hash: fromHash, path: [fromHash], transitions: [] },
    ];
    const visited = new Set([fromHash]);
    while (queue.length > 0) {
        const current = queue.shift();
        const neighbors = reverseEdges.get(current.hash);
        if (!neighbors) {
            continue;
        }
        for (const neighborHash of neighbors) {
            if (neighborHash === toHash) {
                // Found target! Find the transition (reversed)
                const transition = findTransitionBetween(configDir, neighborHash, current.hash);
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
                const transition = findTransitionBetween(configDir, neighborHash, current.hash);
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
export function findAllPaths(configDir, fromHash, toHash) {
    const graph = loadGraph(configDir);
    const paths = [];
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
    function dfs(current, target, path, transitions, visited) {
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
                const transition = findTransitionBetween(configDir, current, neighborHash);
                if (transition) {
                    dfs(neighborHash, target, [...path, neighborHash], [...transitions, transition], visited);
                }
                visited.delete(neighborHash);
            }
        }
    }
    dfs(fromHash, toHash, [fromHash], [], new Set([fromHash]));
    return paths;
}
/**
 * Get direct transition between two snapshots
 */
export function getDirectTransition(configDir, fromHash, toHash) {
    return findTransitionBetween(configDir, fromHash, toHash);
}
/**
 * Helper to find transition between two snapshots
 */
function findTransitionBetween(configDir, fromHash, toHash) {
    const transitions = getAllTransitions(configDir);
    return (transitions.find((t) => t.fromHash === fromHash && t.toHash === toHash) || null);
}
/**
 * Check if path exists between two snapshots
 */
export function pathExists(configDir, fromHash, toHash) {
    return findPath(configDir, fromHash, toHash) !== null;
}
/**
 * Get all reachable snapshots from a given snapshot
 */
export function getReachableSnapshots(configDir, fromHash) {
    const graph = loadGraph(configDir);
    const reachable = new Set();
    if (!graph.nodes.has(fromHash)) {
        return [];
    }
    // BFS to find all reachable nodes
    const queue = [fromHash];
    reachable.add(fromHash);
    while (queue.length > 0) {
        const current = queue.shift();
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
export function getPredecessorSnapshots(configDir, toHash) {
    const graph = loadGraph(configDir);
    const predecessors = new Set();
    if (!graph.nodes.has(toHash)) {
        return [];
    }
    // Build reverse edges map
    const reverseEdges = new Map();
    for (const [from, tos] of graph.edges.entries()) {
        for (const to of tos) {
            if (!reverseEdges.has(to)) {
                reverseEdges.set(to, new Set());
            }
            reverseEdges.get(to).add(from);
        }
    }
    // BFS on reverse graph
    const queue = [toHash];
    predecessors.add(toHash);
    while (queue.length > 0) {
        const current = queue.shift();
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
//# sourceMappingURL=graph.js.map