/**
 * Example Plugin with Directives
 *
 * This example demonstrates how to create a Yama plugin that:
 * - Registers custom directives
 * - Accepts schema-level configuration via $$ blocks
 * - Uses the onSchemaLoaded hook
 *
 * Usage in yama.yaml:
 * ```yaml
 * plugins:
 *   - @yamajs/plugin-search
 *
 * schemas:
 *   Post:
 *     fields:
 *       title: string! @searchable(weight: 2)
 *       content: text! @searchable
 *       status: string @filterable
 *     $$:
 *       search:
 *         index: true
 *         primaryKey: id
 * ```
 */

import { definePlugin } from '../define.js';

/**
 * Search plugin configuration
 */
interface SearchPluginConfig {
    /** Search service URL */
    url?: string;
    /** API key */
    apiKey?: string;
    /** Index prefix */
    indexPrefix?: string;
}

/**
 * Schema-level search configuration
 */
interface SchemaSearchConfig {
    /** Enable indexing for this schema */
    index?: boolean;
    /** Primary key field */
    primaryKey?: string;
    /** Fields to make filterable */
    filterable?: string[];
    /** Fields to make sortable */
    sortable?: string[];
}

/**
 * Example search plugin
 */
export const searchPlugin = definePlugin({
    name: '@yamajs/plugin-search',
    version: '1.0.0',
    description: 'Adds full-text search capabilities to Yama',
    category: 'search',

    // No required plugins
    requires: [],

    // Global config schema
    configSchema: {
        type: 'object',
        properties: {
            url: { type: 'string', description: 'Search service URL' },
            apiKey: { type: 'string', description: 'API key' },
            indexPrefix: { type: 'string', default: 'yama_' },
        },
    },

    // Directives this plugin provides
    directives: {
        '@searchable': {
            targets: ['field'],
            description: 'Marks a field for full-text search indexing',
            argsSchema: {
                type: 'object',
                properties: {
                    weight: { type: 'number', description: 'Search weight (higher = more important)' },
                    boost: { type: 'number', description: 'Alias for weight' },
                },
            },
            onField({ args, meta }) {
                meta.searchable = true;
                meta.searchWeight = (args.weight as number) ?? (args.boost as number) ?? 1;
            },
        },

        '@filterable': {
            targets: ['field'],
            description: 'Marks a field as filterable in search queries',
            onField({ meta }) {
                meta.filterable = true;
            },
        },

        '@sortable': {
            targets: ['field'],
            description: 'Marks a field as sortable in search results',
            onField({ meta }) {
                meta.sortable = true;
            },
        },
    },

    // Schema options for $$ block
    schemaOptions: {
        type: 'object',
        properties: {
            index: {
                type: 'boolean',
                description: 'Enable search indexing for this schema',
            },
            primaryKey: {
                type: 'string',
                description: 'Primary key field (default: id)',
            },
            filterable: {
                type: 'array',
                description: 'Additional filterable fields',
            },
            sortable: {
                type: 'array',
                description: 'Additional sortable fields',
            },
        },
    },

    // Initialize plugin
    async init(config, context) {
        const cfg = config as SearchPluginConfig;
        context.logger.info('Search plugin initialized', {
            url: cfg.url || 'http://localhost:7700',
            indexPrefix: cfg.indexPrefix || 'yama_',
        });

        // Create mock search client
        const searchClient = {
            indexes: new Map<string, any>(),

            async createIndex(name: string, options: any) {
                this.indexes.set(name, { name, options, documents: [] });
                return { name, ...options };
            },

            async search(indexName: string, query: string, options?: any) {
                const index = this.indexes.get(indexName);
                if (!index) throw new Error(`Index ${indexName} not found`);

                // Mock search
                return {
                    hits: [],
                    query,
                    processingTimeMs: 1,
                    limit: options?.limit || 20,
                    offset: options?.offset || 0,
                    estimatedTotalHits: 0,
                };
            },

            async addDocuments(indexName: string, documents: any[]) {
                const index = this.indexes.get(indexName);
                if (!index) throw new Error(`Index ${indexName} not found`);
                index.documents.push(...documents);
                return { taskUid: Math.random() };
            },
        };

        // Return public API
        return {
            search: searchClient.search.bind(searchClient),
            addDocuments: searchClient.addDocuments.bind(searchClient),
            _client: searchClient,
        };
    },

    // Called after schemas are loaded
    async onSchemaLoaded(schemas, context) {
        const api = context.getPluginAPI('@yamajs/plugin-search');
        if (!api) return;

        // Process each schema
        for (const [schemaName, schema] of Object.entries(schemas)) {
            // Check for $$ configuration
            const searchConfig = schema.pluginOptions?.search as SchemaSearchConfig | undefined;

            if (!searchConfig?.index) continue;

            context.logger.info(`Creating search index for schema: ${schemaName}`);

            // Collect searchable/filterable/sortable fields
            const searchableFields: string[] = [];
            const filterableFields: string[] = [...(searchConfig.filterable || [])];
            const sortableFields: string[] = [...(searchConfig.sortable || [])];

            for (const [fieldName, field] of Object.entries(schema.fields)) {
                // Type assertion for field metadata
                const meta = (field as any).meta || {};

                if (meta.searchable) {
                    searchableFields.push(fieldName);
                }
                if (meta.filterable && !filterableFields.includes(fieldName)) {
                    filterableFields.push(fieldName);
                }
                if (meta.sortable && !sortableFields.includes(fieldName)) {
                    sortableFields.push(fieldName);
                }
            }

            // Create search index
            await api._client.createIndex(schemaName, {
                primaryKey: searchConfig.primaryKey || 'id',
                searchableAttributes: searchableFields,
                filterableAttributes: filterableFields,
                sortableAttributes: sortableFields,
            });

            context.logger.info(`Created search index: ${schemaName}`, {
                searchable: searchableFields,
                filterable: filterableFields,
                sortable: sortableFields,
            });
        }
    },
});

export default searchPlugin;
