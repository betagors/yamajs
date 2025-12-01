import type { PluginManifest } from "./base.js";
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
export declare function buildDependencyGraph(plugins: Map<string, PluginManifest>): Map<string, DependencyNode>;
/**
 * Detect circular dependencies using DFS
 */
export declare function detectCircularDependencies(graph: Map<string, DependencyNode>): string[][];
/**
 * Topological sort for dependency resolution
 * Returns load order (dependencies first)
 */
export declare function topologicalSort(graph: Map<string, DependencyNode>): string[];
/**
 * Resolve plugin dependencies
 * @param pluginNames - List of plugin names to resolve
 * @param projectDir - Project directory for loading manifests
 */
export declare function resolvePluginDependencies(pluginNames: string[], projectDir?: string): Promise<DependencyResolution>;
/**
 * Validate dependencies are satisfied
 */
export declare function validateDependencies(pluginName: string, manifest: PluginManifest, loadedPlugins: Set<string>): {
    valid: boolean;
    missing: string[];
};
export {};
