import type { PluginManifest, YamaPlugin } from "../../../../../../../../core/kernel/src/plugins/base.js";
import { loadPluginFromPackage } from "../../../../../../../../core/kernel/src/plugins/loader.js";

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
 * Plugin relationship validation result
 */
export interface RelationshipValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  missingOptional: string[];
  conflicts: string[];
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
    // Note: buildDependencyGraph in this file is used with PluginManifest (from package.json)
    // which may still have manifest.dependencies.plugins for pre-load resolution.
    // However, since we are removing legacy, we should encourage moving to 'requires'.
    // For manifest, it's still 'dependencies.plugins' in package.json usually.
    // But let's check both just in case.
    const dependencies = (manifest as any).requires || (manifest.dependencies as any)?.plugins || [];
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
      const dependencies = (manifest as any).requires || (manifest.dependencies as any)?.plugins || [];
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


// ============================================================================
// NEW: Enhanced plugin relationship validation
// ============================================================================

/**
 * Validate plugin relationships (requires, optional, conflicts)
 * 
 * This is the enhanced validation that uses the new YamaPlugin fields
 * instead of the legacy manifest.dependencies.plugins
 * 
 * @param plugin - The plugin to validate
 * @param loadedPlugins - Set of plugin names that are loaded/available
 * @returns Validation result with detailed errors and warnings
 */
export function validatePluginRelationships(
  plugin: YamaPlugin,
  loadedPlugins: Set<string>
): RelationshipValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingRequired: string[] = [];
  const missingOptional: string[] = [];
  const conflicts: string[] = [];

  // Check required plugins
  if (plugin.requires && plugin.requires.length > 0) {
    for (const required of plugin.requires) {
      if (!loadedPlugins.has(required)) {
        missingRequired.push(required);
        errors.push(
          `Plugin "${plugin.name}" requires "${required}" but it is not loaded. ` +
          `Install it with: pnpm add ${required}`
        );
      }
    }
  }

  // Check optional plugins (just report, don't fail)
  if (plugin.optional && plugin.optional.length > 0) {
    for (const optional of plugin.optional) {
      if (!loadedPlugins.has(optional)) {
        missingOptional.push(optional);
        warnings.push(
          `Plugin "${plugin.name}" optionally uses "${optional}" but it is not loaded. ` +
          `Some features may be disabled.`
        );
      }
    }
  }

  // Check conflicting plugins
  if (plugin.conflicts && plugin.conflicts.length > 0) {
    for (const conflict of plugin.conflicts) {
      if (loadedPlugins.has(conflict)) {
        conflicts.push(conflict);
        errors.push(
          `Plugin "${plugin.name}" conflicts with "${conflict}". ` +
          `These plugins cannot be used together. Remove one of them.`
        );
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    missingRequired,
    missingOptional,
    conflicts,
  };
}

/**
 * Check for conflicts between all loaded plugins
 * 
 * @param plugins - Map of plugin name to YamaPlugin
 * @returns Array of conflict descriptions
 */
export function detectPluginConflicts(
  plugins: Map<string, YamaPlugin>
): string[] {
  const conflicts: string[] = [];
  const pluginNames = new Set(plugins.keys());

  for (const [name, plugin] of plugins.entries()) {
    if (plugin.conflicts) {
      for (const conflict of plugin.conflicts) {
        if (pluginNames.has(conflict)) {
          // Avoid duplicate conflict reports (A conflicts B and B conflicts A)
          const conflictKey = [name, conflict].sort().join(' <-> ');
          const conflictMsg = `Conflict: ${conflictKey}`;
          if (!conflicts.includes(conflictMsg)) {
            conflicts.push(conflictMsg);
          }
        }
      }
    }
  }

  return conflicts;
}

/**
 * Build enhanced dependency graph using new requires field
 * Falls back to legacy manifest.dependencies.plugins if requires is not defined
 * 
 * @param plugins - Map of plugin name to YamaPlugin
 * @returns Enhanced dependency graph
 */
export function buildEnhancedDependencyGraph(
  plugins: Map<string, YamaPlugin>
): Map<string, { requires: string[]; optional: string[]; dependents: string[] }> {
  const graph = new Map<string, { requires: string[]; optional: string[]; dependents: string[] }>();

  // Initialize nodes
  for (const [name, plugin] of plugins.entries()) {
    // Only use new requires field
    const requires = plugin.requires || [];
    const optional = plugin.optional || [];

    graph.set(name, {
      requires,
      optional,
      dependents: [],
    });
  }

  // Build dependents list (who depends on me?)
  for (const [name, node] of graph.entries()) {
    for (const dep of node.requires) {
      const depNode = graph.get(dep);
      if (depNode) {
        depNode.dependents.push(name);
      }
    }
  }

  return graph;
}

/**
 * Get shutdown order (reverse of load order)
 * Dependents shut down before their dependencies
 * 
 * @param loadOrder - The load order from topological sort
 * @returns Shutdown order (reversed)
 */
export function getShutdownOrder(loadOrder: string[]): string[] {
  return [...loadOrder].reverse();
}

/**
 * Check if a plugin can be safely loaded given current state
 * 
 * @param plugin - The plugin to check
 * @param loadedPlugins - Currently loaded plugins
 * @param pendingPlugins - Plugins that will be loaded (in order)
 * @returns Whether the plugin can be loaded and any issues
 */
export function canLoadPlugin(
  plugin: YamaPlugin,
  loadedPlugins: Set<string>,
  pendingPlugins: string[] = []
): { canLoad: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const available = new Set([...loadedPlugins, ...pendingPlugins]);

  // Check required plugins
  if (plugin.requires) {
    for (const required of plugin.requires) {
      if (!available.has(required)) {
        blockers.push(`Missing required plugin: ${required}`);
      }
    }
  }

  // Check conflicts
  if (plugin.conflicts) {
    for (const conflict of plugin.conflicts) {
      if (available.has(conflict)) {
        blockers.push(`Conflicts with loaded plugin: ${conflict}`);
      }
    }
  }

  return {
    canLoad: blockers.length === 0,
    blockers,
  };
}















