import type { PluginManifest } from "./base.js";
import { loadPluginFromPackage } from "./loader.js";

/**
 * Dependency graph node
 */
interface DependencyNode {
  name: string;
  manifest: PluginManifest;
  dependencies: string[];
  dependents: string[];
}

/**
 * Dependency resolution result
 */
export interface DependencyResolution {
  /**
   * Load order (topological sort)
   */
  loadOrder: string[];
  
  /**
   * Circular dependencies detected
   */
  circular: string[][];
  
  /**
   * Missing dependencies
   */
  missing: string[];
}

/**
 * Build dependency graph from manifests
 */
export function buildDependencyGraph(
  plugins: Map<string, PluginManifest>
): Map<string, DependencyNode> {
  const graph = new Map<string, DependencyNode>();

  // Initialize nodes
  for (const [name, manifest] of plugins.entries()) {
    const dependencies = manifest.dependencies?.plugins || [];
    graph.set(name, {
      name,
      manifest,
      dependencies,
      dependents: [],
    });
  }

  // Build dependents list
  for (const [name, node] of graph.entries()) {
    for (const dep of node.dependencies) {
      const depNode = graph.get(dep);
      if (depNode) {
        depNode.dependents.push(name);
      }
    }
  }

  return graph;
}

/**
 * Detect circular dependencies using DFS
 */
export function detectCircularDependencies(
  graph: Map<string, DependencyNode>
): string[][] {
  const circular: string[][] = [];
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function dfs(nodeName: string): void {
    visited.add(nodeName);
    recursionStack.add(nodeName);
    path.push(nodeName);

    const node = graph.get(nodeName);
    if (node) {
      for (const dep of node.dependencies) {
        if (!visited.has(dep)) {
          dfs(dep);
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          const cycleStart = path.indexOf(dep);
          const cycle = path.slice(cycleStart).concat([dep]);
          circular.push(cycle);
        }
      }
    }

    recursionStack.delete(nodeName);
    path.pop();
  }

  for (const name of graph.keys()) {
    if (!visited.has(name)) {
      dfs(name);
    }
  }

  return circular;
}

/**
 * Topological sort for dependency resolution
 * Returns load order (dependencies first)
 */
export function topologicalSort(
  graph: Map<string, DependencyNode>
): string[] {
  const loadOrder: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(nodeName: string): void {
    if (visiting.has(nodeName)) {
      // Circular dependency detected (should be caught earlier, but handle gracefully)
      return;
    }

    if (visited.has(nodeName)) {
      return;
    }

    visiting.add(nodeName);

    const node = graph.get(nodeName);
    if (node) {
      // Visit dependencies first
      for (const dep of node.dependencies) {
        visit(dep);
      }
    }

    visiting.delete(nodeName);
    visited.add(nodeName);
    loadOrder.push(nodeName);
  }

  // Visit all nodes
  for (const name of graph.keys()) {
    if (!visited.has(name)) {
      visit(name);
    }
  }

  return loadOrder;
}

/**
 * Resolve plugin dependencies
 * @param pluginNames - List of plugin names to resolve
 * @param projectDir - Project directory for loading manifests
 */
export async function resolvePluginDependencies(
  pluginNames: string[],
  projectDir?: string
): Promise<DependencyResolution> {
  const manifests = new Map<string, PluginManifest>();
  const missing: string[] = [];

  // Load all manifests (including dependencies)
  async function loadManifest(name: string): Promise<void> {
    if (manifests.has(name)) {
      return; // Already loaded
    }

    try {
      const manifest = await loadPluginFromPackage(name, projectDir);
      manifests.set(name, manifest);

      // Recursively load dependencies
      const dependencies = manifest.dependencies?.plugins || [];
      for (const dep of dependencies) {
        await loadManifest(dep);
      }
    } catch (error) {
      // Plugin not found
      missing.push(name);
    }
  }

  // Load all plugins and their dependencies
  for (const name of pluginNames) {
    await loadManifest(name);
  }

  // Build dependency graph
  const graph = buildDependencyGraph(manifests);

  // Detect circular dependencies
  const circular = detectCircularDependencies(graph);

  // Topological sort for load order
  const loadOrder = topologicalSort(graph);

  return {
    loadOrder,
    circular,
    missing,
  };
}

/**
 * Validate dependencies are satisfied
 */
export function validateDependencies(
  pluginName: string,
  manifest: PluginManifest,
  loadedPlugins: Set<string>
): { valid: boolean; missing: string[] } {
  const dependencies = manifest.dependencies?.plugins || [];
  const missing: string[] = [];

  for (const dep of dependencies) {
    if (!loadedPlugins.has(dep)) {
      missing.push(dep);
    }
  }

  return {
    valid: missing.length === 0,
    missing,
  };
}



















