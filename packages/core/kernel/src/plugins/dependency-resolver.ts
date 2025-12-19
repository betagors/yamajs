/**
 * Dependency Resolver - Cross-Plugin Migration Dependencies
 *
 * Resolves and validates plugin dependencies before migration execution.
 * Ensures plugins are installed in the correct order and dependencies are satisfied.
 */

import type { PluginManifest, PluginMigrationDefinition } from "../../../../../../../../../../../core/kernel/src/plugins/base.js";

/**
 * Migration dependency specification
 */
export interface MigrationDependency {
    /** Plugin name (e.g., "@yamajs/plugin-clerk") */
    plugin: string;

    /** Minimum version required (semver) */
    minVersion: string;

    /** Specific migration version required (optional) */
    migrationVersion?: string;
}

/**
 * Missing dependency information
 */
export interface MissingDependency {
    /** The dependency that's missing */
    dependency: MigrationDependency;

    /** Currently installed version (null if not installed) */
    installedVersion: string | null;

    /** Reason the dependency is not satisfied */
    reason: string;
}

/**
 * Dependency resolution result
 */
export interface DependencyResolutionResult {
    /** Whether all dependencies are satisfied */
    satisfied: boolean;

    /** List of missing or unsatisfied dependencies */
    missing: MissingDependency[];

    /** Correct execution order for migrations */
    order: string[];

    /** Warnings (non-blocking issues) */
    warnings: string[];
}

/**
 * Circular dependency detection result
 */
export interface CircularDependencyCheck {
    /** Whether a circular dependency was detected */
    hasCircular: boolean;

    /** The cycle path if found */
    cycle: string[];
}

/**
 * Compare two semver versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
    const parseVersion = (v: string): number[] => {
        const match = v.match(/^(\d+)\.(\d+)\.(\d+)/);
        if (!match) return [0, 0, 0];
        return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    };

    const [aMajor, aMinor, aPatch] = parseVersion(a);
    const [bMajor, bMinor, bPatch] = parseVersion(b);

    if (aMajor !== bMajor) return aMajor < bMajor ? -1 : 1;
    if (aMinor !== bMinor) return aMinor < bMinor ? -1 : 1;
    if (aPatch !== bPatch) return aPatch < bPatch ? -1 : 1;
    return 0;
}

/**
 * Check if version satisfies minimum version requirement
 */
export function satisfiesVersion(installed: string, required: string): boolean {
    return compareVersions(installed, required) >= 0;
}

/**
 * Parse migration dependencies from manifest
 */
export function parseMigrationDependencies(
    manifest: PluginManifest
): Map<string, MigrationDependency[]> {
    const dependencies = new Map<string, MigrationDependency[]>();

    if (!manifest.migrations) {
        return dependencies;
    }

    for (const [version, migration] of Object.entries(manifest.migrations)) {
        const migrationDef = migration as PluginMigrationDefinition & {
            requires?: Array<{ plugin: string; version: string }>;
        };

        if (migrationDef.requires && Array.isArray(migrationDef.requires)) {
            const deps: MigrationDependency[] = migrationDef.requires.map((req) => ({
                plugin: req.plugin,
                minVersion: req.version,
                migrationVersion: version,
            }));
            dependencies.set(version, deps);
        }
    }

    return dependencies;
}

/**
 * Get all unique plugin dependencies from manifest
 */
export function getAllPluginDependencies(manifest: PluginManifest): MigrationDependency[] {
    const allDeps = new Map<string, MigrationDependency>();
    const migrationDeps = parseMigrationDependencies(manifest);

    for (const deps of Array.from(migrationDeps.values())) {
        for (const dep of deps) {
            const existing = allDeps.get(dep.plugin);
            if (!existing || compareVersions(dep.minVersion, existing.minVersion) > 0) {
                allDeps.set(dep.plugin, dep);
            }
        }
    }

    // Also check manifest-level dependencies
    if (manifest.dependencies?.plugins) {
        for (const plugin of manifest.dependencies.plugins) {
            if (!allDeps.has(plugin)) {
                allDeps.set(plugin, { plugin, minVersion: "0.0.0" });
            }
        }
    }

    return Array.from(allDeps.values());
}

/**
 * Resolve dependencies for a single plugin migration
 */
export function resolveDependencies(
    pluginName: string,
    manifest: PluginManifest,
    installedVersions: Map<string, string>,
    targetVersion?: string
): DependencyResolutionResult {
    const missing: MissingDependency[] = [];
    const warnings: string[] = [];
    const order: string[] = [];

    const migrationDeps = parseMigrationDependencies(manifest);

    // Get all migrations up to target version
    const migrationsToRun = Object.keys(manifest.migrations || {})
        .filter((v) => !targetVersion || compareVersions(v, targetVersion) <= 0)
        .sort(compareVersions);

    // Check dependencies for each migration
    for (const migrationVersion of migrationsToRun) {
        const deps = migrationDeps.get(migrationVersion) || [];

        for (const dep of deps) {
            const installedVersion = installedVersions.get(dep.plugin);

            if (!installedVersion) {
                missing.push({
                    dependency: dep,
                    installedVersion: null,
                    reason: `Plugin "${dep.plugin}" is not installed`,
                });
            } else if (!satisfiesVersion(installedVersion, dep.minVersion)) {
                missing.push({
                    dependency: dep,
                    installedVersion,
                    reason: `Plugin "${dep.plugin}" version ${installedVersion} does not satisfy required version >= ${dep.minVersion}`,
                });
            } else {
                // Dependency satisfied, add to order if not already present
                if (!order.includes(dep.plugin)) {
                    order.push(dep.plugin);
                }
            }
        }
    }

    // Add the current plugin at the end
    if (!order.includes(pluginName)) {
        order.push(pluginName);
    }

    return {
        satisfied: missing.length === 0,
        missing,
        order,
        warnings,
    };
}

/**
 * Build dependency graph for multiple plugins
 */
export function buildDependencyGraph(
    plugins: string[],
    manifests: Map<string, PluginManifest>
): Map<string, string[]> {
    const graph = new Map<string, string[]>();

    for (const plugin of plugins) {
        const manifest = manifests.get(plugin);
        if (!manifest) continue;

        const deps = getAllPluginDependencies(manifest);
        graph.set(
            plugin,
            deps.map((d) => d.plugin)
        );
    }

    return graph;
}

/**
 * Detect circular dependencies
 */
export function detectCircularDependencies(
    graph: Map<string, string[]>
): CircularDependencyCheck {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    function dfs(node: string): string[] | null {
        visited.add(node);
        recursionStack.add(node);
        path.push(node);

        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                const cycle = dfs(neighbor);
                if (cycle) return cycle;
            } else if (recursionStack.has(neighbor)) {
                // Found cycle
                const cycleStart = path.indexOf(neighbor);
                return [...path.slice(cycleStart), neighbor];
            }
        }

        path.pop();
        recursionStack.delete(node);
        return null;
    }

    for (const node of Array.from(graph.keys())) {
        if (!visited.has(node)) {
            const cycle = dfs(node);
            if (cycle) {
                return { hasCircular: true, cycle };
            }
        }
    }

    return { hasCircular: false, cycle: [] };
}

/**
 * Topological sort for plugin execution order
 */
export function topologicalSort(graph: Map<string, string[]>): string[] | null {
    const inDegree = new Map<string, number>();
    const nodes = new Set<string>();

    // Initialize in-degree for all nodes
    for (const [node, deps] of graph) {
        nodes.add(node);
        if (!inDegree.has(node)) {
            inDegree.set(node, 0);
        }
        for (const dep of deps) {
            nodes.add(dep);
            inDegree.set(dep, (inDegree.get(dep) || 0) + 1);
        }
    }

    // Find all nodes with in-degree 0 (no dependencies)
    const queue: string[] = [];
    for (const node of Array.from(nodes)) {
        if ((inDegree.get(node) || 0) === 0) {
            queue.push(node);
        }
    }

    const result: string[] = [];
    while (queue.length > 0) {
        const node = queue.shift()!;
        result.push(node);

        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
            const newDegree = (inDegree.get(neighbor) || 1) - 1;
            inDegree.set(neighbor, newDegree);
            if (newDegree === 0) {
                queue.push(neighbor);
            }
        }
    }

    // If we didn't process all nodes, there's a cycle
    if (result.length !== nodes.size) {
        return null;
    }

    return result;
}

/**
 * Validate dependency chain for multiple plugins
 */
export function validateDependencyChain(
    plugins: string[],
    manifests: Map<string, PluginManifest>,
    installedVersions: Map<string, string>
): DependencyResolutionResult {
    const allMissing: MissingDependency[] = [];
    const allWarnings: string[] = [];

    // Build dependency graph
    const graph = buildDependencyGraph(plugins, manifests);

    // Check for circular dependencies
    const circularCheck = detectCircularDependencies(graph);
    if (circularCheck.hasCircular) {
        allWarnings.push(`Circular dependency detected: ${circularCheck.cycle.join(" -> ")}`);
        return {
            satisfied: false,
            missing: [],
            order: [],
            warnings: [...allWarnings, "Cannot resolve plugin order due to circular dependencies"],
        };
    }

    // Get execution order
    const order = topologicalSort(graph);
    if (!order) {
        return {
            satisfied: false,
            missing: [],
            order: [],
            warnings: ["Failed to determine plugin execution order"],
        };
    }

    // Validate each plugin's dependencies
    for (const plugin of plugins) {
        const manifest = manifests.get(plugin);
        if (!manifest) {
            allWarnings.push(`Manifest not found for plugin: ${plugin}`);
            continue;
        }

        const result = resolveDependencies(plugin, manifest, installedVersions);
        allMissing.push(...result.missing);
        allWarnings.push(...result.warnings);
    }

    return {
        satisfied: allMissing.length === 0,
        missing: allMissing,
        order,
        warnings: allWarnings,
    };
}

/**
 * Format dependency resolution result for display
 */
export function formatDependencyResult(result: DependencyResolutionResult): string {
    const lines: string[] = [];

    if (result.satisfied) {
        lines.push("✅ All dependencies satisfied");
    } else {
        lines.push("❌ Missing dependencies:");
        lines.push("");
        for (const missing of result.missing) {
            lines.push(`  🔴 ${missing.dependency.plugin} >= ${missing.dependency.minVersion}`);
            lines.push(`     ${missing.reason}`);
            if (missing.installedVersion) {
                lines.push(`     Installed: ${missing.installedVersion}`);
            }
            lines.push("");
        }
    }

    if (result.warnings.length > 0) {
        lines.push("");
        lines.push("⚠️ Warnings:");
        for (const warning of result.warnings) {
            lines.push(`  ${warning}`);
        }
    }

    if (result.order.length > 0) {
        lines.push("");
        lines.push("📋 Execution order:");
        for (let i = 0; i < result.order.length; i++) {
            lines.push(`  ${i + 1}. ${result.order[i]}`);
        }
    }

    return lines.join("\n");
}

/**
 * Check if a specific migration can run
 */
export function canMigrationRun(
    pluginName: string,
    migrationVersion: string,
    manifest: PluginManifest,
    installedVersions: Map<string, string>
): { canRun: boolean; blockedBy: MissingDependency[] } {
    const migrationDeps = parseMigrationDependencies(manifest);
    const deps = migrationDeps.get(migrationVersion) || [];
    const blockedBy: MissingDependency[] = [];

    for (const dep of deps) {
        const installedVersion = installedVersions.get(dep.plugin);

        if (!installedVersion) {
            blockedBy.push({
                dependency: dep,
                installedVersion: null,
                reason: `Plugin "${dep.plugin}" is not installed`,
            });
        } else if (!satisfiesVersion(installedVersion, dep.minVersion)) {
            blockedBy.push({
                dependency: dep,
                installedVersion,
                reason: `Version ${installedVersion} < required ${dep.minVersion}`,
            });
        }
    }

    return {
        canRun: blockedBy.length === 0,
        blockedBy,
    };
}
