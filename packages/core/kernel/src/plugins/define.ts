/**
 * Yama Plugin Definition Helper
 *
 * Provides a type-safe way to define Yama plugins with full autocomplete
 * and validation support.
 */

import type {
    YamaPlugin,
    PluginContext,
    PluginDirectiveDefinition,
    PluginSchemaOptionsSchema,
    SchemaWithPluginOptions,
    PluginLifecycle,
    PluginRelationships,
    PluginManifest,
} from '../../../../../../../../core/kernel/src/plugins/base.js';

/**
 * Plugin definition input type
 *
 * This is the type developers use when defining a plugin with `definePlugin()`.
 * It provides a cleaner API than implementing YamaPlugin directly.
 */
export interface PluginDefinition {
    // =========================================================================
    // Identity
    // =========================================================================

    /** Plugin name (package name, e.g., "@yamajs/plugin-meilisearch") */
    name: string;

    /** Plugin version (semver) */
    version?: string;

    /** Human-readable description */
    description?: string;

    /** Plugin author */
    author?: string;

    /** Repository URL */
    repository?: string;

    /** Plugin category (e.g., "search", "auth", "payments") */
    category?: string;

    /** Plugin API version */
    pluginApi?: string;

    /** Compatible Yama core version (semver range) */
    yamaCore?: string;

    // =========================================================================
    // Dependencies
    // =========================================================================

    /**
     * Required plugins - must be loaded before this plugin
     * If missing, plugin loading will fail with clear error
     */
    requires?: string[];

    /**
     * Optional plugins - used if available, gracefully ignored if not
     */
    optional?: string[];

    /**
     * Conflicting plugins - cannot be loaded together
     */
    conflicts?: string[];

    // =========================================================================
    // Configuration
    // =========================================================================

    /**
     * Global configuration schema (JSON Schema)
     * Used to validate configuration passed to init()
     */
    configSchema?: Record<string, unknown>;

    // =========================================================================
    // Directives
    // =========================================================================

    /**
     * Directives this plugin provides
     * Map of directive name (with @) to definition
     *
     * @example
     * ```typescript
     * directives: {
     *   '@searchable': {
     *     targets: ['field'],
     *     description: 'Marks field for full-text search',
     *     onField({ fieldType, args, meta }) {
     *       meta.searchable = true;
     *       meta.searchWeight = args.weight ?? 1;
     *     }
     *   }
     * }
     * ```
     */
    directives?: Record<string, PluginDirectiveDefinition>;

    // =========================================================================
    // Schema Options
    // =========================================================================

    /**
     * Schema-level options this plugin accepts (from $$ block)
     * JSON Schema that validates plugin configuration in schema $$ blocks
     *
     * @example
     * ```typescript
     * schemaOptions: {
     *   type: 'object',
     *   properties: {
     *     index: { type: 'boolean', default: false },
     *     filterable: { type: 'array', items: { type: 'string' } }
     *   }
     * }
     * ```
     */
    schemaOptions?: PluginSchemaOptionsSchema;

    // =========================================================================
    // Lifecycle Hooks
    // =========================================================================

    /**
     * Called when plugin is initialized (during load phase)
     * Return the plugin API that will be exposed to users
     */
    init(opts: Record<string, unknown>, context: PluginContext): Promise<unknown>;

    /**
     * Called after ALL plugins have been initialized
     * This is the safe place to interact with other plugins
     */
    onReady?(context: PluginContext): void | Promise<void>;

    /**
     * Called after all schemas have been loaded, with $$ configs
     */
    onSchemaLoaded?(
        schemas: Record<string, SchemaWithPluginOptions>,
        context: PluginContext
    ): void | Promise<void>;

    /**
     * Called during graceful shutdown
     * Use for cleanup: close connections, flush buffers, etc.
     */
    onShutdown?(context: PluginContext): void | Promise<void>;

    /**
     * Called when an error occurs
     */
    onError?(error: Error): void;

    /**
     * Health check hook - called to verify plugin is healthy
     */
    onHealthCheck?(): Promise<{
        healthy: boolean;
        latency?: number;
        details?: Record<string, unknown>;
        error?: string;
    }> | {
        healthy: boolean;
        latency?: number;
        details?: Record<string, unknown>;
        error?: string;
    };
}

/**
 * Define a Yama plugin with full type safety
 *
 * This is the recommended way to create plugins. It provides:
 * - Full TypeScript autocomplete
 * - Validation of plugin structure
 * - Consistent plugin interface
 *
 * @example
 * ```typescript
 * import { definePlugin } from '@yamajs/kernel';
 *
 * export default definePlugin({
 *   name: '@yamajs/plugin-meilisearch',
 *   version: '1.0.0',
 *
 *   requires: ['@yamajs/jobs'],
 *
 *   directives: {
 *     '@searchable': {
 *       targets: ['field'],
 *       onField({ meta }) {
 *         meta.searchable = true;
 *       }
 *     }
 *   },
 *
 *   schemaOptions: {
 *     type: 'object',
 *     properties: {
 *       index: { type: 'boolean' }
 *     }
 *   },
 *
 *   async init(config, context) {
 *     const client = new MeiliSearch(config);
 *     return { search: (q) => client.search(q) };
 *   },
 *
 *   async onSchemaLoaded(schemas, context) {
 *     for (const [name, schema] of Object.entries(schemas)) {
 *       if (schema.pluginOptions?.meilisearch?.index) {
 *         // Create search index for this schema
 *       }
 *     }
 *   }
 * });
 * ```
 */
export function definePlugin(definition: PluginDefinition): YamaPlugin {
    // Convert PluginDefinition to YamaPlugin format
    const plugin: YamaPlugin = {
        // Identity
        name: definition.name,
        version: definition.version,
        description: definition.description,
        author: definition.author,
        repository: definition.repository,
        category: definition.category,
        pluginApi: definition.pluginApi,
        yamaCore: definition.yamaCore,

        // Dependencies (from PluginRelationships)
        requires: definition.requires,
        optional: definition.optional,
        conflicts: definition.conflicts,

        // Manifest with config schema
        manifest: definition.configSchema
            ? ({ configSchema: definition.configSchema } as PluginManifest)
            : undefined,

        // Directives and schema options
        directives: definition.directives,
        schemaOptions: definition.schemaOptions,

        // Lifecycle hooks
        init: definition.init,
        onReady: definition.onReady,
        onSchemaLoaded: definition.onSchemaLoaded,
        onShutdown: definition.onShutdown,
        onError: definition.onError,
        onHealthCheck: definition.onHealthCheck,
    };

    return plugin;
}

/**
 * Type helper to extract the API type from a plugin definition
 */
export type PluginAPI<T extends PluginDefinition> = T extends {
    init(...args: any[]): Promise<infer API>;
}
    ? API
    : never;

/**
 * Validate a plugin definition at runtime
 */
export function validatePluginDefinition(
    definition: unknown
): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!definition || typeof definition !== 'object') {
        return { valid: false, errors: ['Plugin definition must be an object'] };
    }

    const def = definition as Record<string, unknown>;

    // Required fields
    if (!def.name || typeof def.name !== 'string') {
        errors.push('Plugin must have a name (string)');
    }

    if (!def.init || typeof def.init !== 'function') {
        errors.push('Plugin must have an init function');
    }

    // Validate directives structure
    if (def.directives) {
        if (typeof def.directives !== 'object') {
            errors.push('directives must be an object');
        } else {
            for (const [name, directive] of Object.entries(
                def.directives as Record<string, unknown>
            )) {
                if (!name.startsWith('@')) {
                    errors.push(`Directive "${name}" must start with @`);
                }
                if (!directive || typeof directive !== 'object') {
                    errors.push(`Directive "${name}" must be an object`);
                } else {
                    const dir = directive as Record<string, unknown>;
                    if (!dir.targets || !Array.isArray(dir.targets)) {
                        errors.push(`Directive "${name}" must have targets array`);
                    }
                }
            }
        }
    }

    // Validate schemaOptions structure
    if (def.schemaOptions) {
        const opts = def.schemaOptions as Record<string, unknown>;
        if (opts.type !== 'object') {
            errors.push('schemaOptions.type must be "object"');
        }
        if (!opts.properties || typeof opts.properties !== 'object') {
            errors.push('schemaOptions.properties must be an object');
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}
