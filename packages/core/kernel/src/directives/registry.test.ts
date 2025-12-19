/**
 * Directive Registry Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DirectiveRegistry } from '../../../../../../../../core/kernel/src/directives/registry.js';

describe('DirectiveRegistry', () => {
    let registry: DirectiveRegistry;

    beforeEach(() => {
        registry = new DirectiveRegistry();
    });

    describe('register', () => {
        it('registers a directive', () => {
            registry.register({
                name: '@unique',
                pluginName: '@yamajs/kernel',
                targets: ['field'],
                description: 'Unique constraint',
            });

            expect(registry.has('@unique')).toBe(true);
            expect(registry.get('@unique')).toMatchObject({
                name: '@unique',
                pluginName: '@yamajs/kernel',
            });
        });

        it('also registers namespaced version', () => {
            registry.register({
                name: '@searchable',
                pluginName: '@yamajs/plugin-meilisearch',
                targets: ['field'],
            });

            // Both short and namespaced should work
            expect(registry.has('@searchable')).toBe(true);
            expect(registry.has('@meilisearch.searchable')).toBe(true);

            // Both should resolve to same definition
            expect(registry.get('@searchable')).toEqual(registry.get('@meilisearch.searchable'));
        });

        it('throws on conflict from different plugins', () => {
            registry.register({
                name: '@email',
                pluginName: '@yamajs/plugin-clerk',
                targets: ['field'],
            });

            expect(() => {
                registry.register({
                    name: '@email',
                    pluginName: '@yamajs/plugin-sendgrid',
                    targets: ['field'],
                });
            }).toThrow(/PluginConflictError/);
        });

        it('allows same directive from same plugin', () => {
            registry.register({
                name: '@unique',
                pluginName: '@yamajs/kernel',
                targets: ['field'],
            });

            // Re-registering from same plugin should not throw
            expect(() => {
                registry.register({
                    name: '@unique',
                    pluginName: '@yamajs/kernel',
                    targets: ['field', 'schema'], // Updated
                });
            }).not.toThrow();
        });

        it('rejects directive names without @', () => {
            expect(() => {
                registry.register({
                    name: 'unique',
                    pluginName: '@yamajs/kernel',
                    targets: ['field'],
                });
            }).toThrow(/must start with @/);
        });
    });

    describe('unregister', () => {
        it('removes all directives from a plugin', () => {
            registry.register({
                name: '@searchable',
                pluginName: '@yamajs/plugin-meilisearch',
                targets: ['field'],
            });
            registry.register({
                name: '@filterable',
                pluginName: '@yamajs/plugin-meilisearch',
                targets: ['field'],
            });

            expect(registry.has('@searchable')).toBe(true);
            expect(registry.has('@filterable')).toBe(true);

            registry.unregister('@yamajs/plugin-meilisearch');

            expect(registry.has('@searchable')).toBe(false);
            expect(registry.has('@filterable')).toBe(false);
            expect(registry.has('@meilisearch.searchable')).toBe(false);
        });
    });

    describe('validateTarget', () => {
        beforeEach(() => {
            registry.register({
                name: '@unique',
                pluginName: '@yamajs/kernel',
                targets: ['field'],
            });
            registry.register({
                name: '@deprecated',
                pluginName: '@yamajs/kernel',
                targets: ['field', 'schema'],
            });
            registry.register({
                name: '@auth',
                pluginName: '@yamajs/kernel',
                targets: ['both'],
            });
        });

        it('validates field directive on field', () => {
            const result = registry.validateTarget('@unique', 'field');
            expect(result.valid).toBe(true);
        });

        it('rejects field directive on schema', () => {
            const result = registry.validateTarget('@unique', 'schema');
            expect(result.valid).toBe(false);
            expect(result.errors?.[0]).toContain('cannot be used on schema');
        });

        it('validates directive with both targets', () => {
            expect(registry.validateTarget('@auth', 'field').valid).toBe(true);
            expect(registry.validateTarget('@auth', 'schema').valid).toBe(true);
        });

        it('validates directive with multiple targets', () => {
            expect(registry.validateTarget('@deprecated', 'field').valid).toBe(true);
            expect(registry.validateTarget('@deprecated', 'schema').valid).toBe(true);
        });

        it('returns error for unknown directive', () => {
            const result = registry.validateTarget('@unknown', 'field');
            expect(result.valid).toBe(false);
            expect(result.errors?.[0]).toContain('Unknown directive');
        });
    });

    describe('validateArgs', () => {
        beforeEach(() => {
            registry.register({
                name: '@default',
                pluginName: '@yamajs/kernel',
                targets: ['field'],
                argsSchema: {
                    type: 'object',
                    properties: {
                        _value: { description: 'Default value' },
                    },
                },
            });
            registry.register({
                name: '@min',
                pluginName: '@yamajs/kernel',
                targets: ['field'],
                argsSchema: {
                    type: 'object',
                    properties: {
                        _value: { type: 'number' },
                    },
                    required: ['_value'],
                },
            });
        });

        it('accepts valid args', () => {
            const result = registry.validateArgs('@default', { _value: 'hello' });
            expect(result.valid).toBe(true);
        });

        it('reports missing required args', () => {
            const result = registry.validateArgs('@min', {});
            expect(result.valid).toBe(false);
            expect(result.errors?.[0]).toContain('Missing required argument');
        });

        it('reports type mismatch', () => {
            const result = registry.validateArgs('@min', { _value: 'not-a-number' });
            expect(result.valid).toBe(false);
            expect(result.errors?.[0]).toContain('expected number');
        });
    });

    describe('getAll / getByPlugin', () => {
        beforeEach(() => {
            registry.register({
                name: '@unique',
                pluginName: '@yamajs/kernel',
                targets: ['field'],
            });
            registry.register({
                name: '@searchable',
                pluginName: '@yamajs/plugin-meilisearch',
                targets: ['field'],
            });
            registry.register({
                name: '@filterable',
                pluginName: '@yamajs/plugin-meilisearch',
                targets: ['field'],
            });
        });

        it('getAll returns unique directives without aliases', () => {
            const all = registry.getAll();
            expect(all).toHaveLength(3);
            expect(all.map((d) => d.name)).toEqual([
                '@unique',
                '@searchable',
                '@filterable',
            ]);
        });

        it('getByPlugin returns only that plugins directives', () => {
            const meilisearch = registry.getByPlugin('@yamajs/plugin-meilisearch');
            expect(meilisearch).toHaveLength(2);
            expect(meilisearch.map((d) => d.name)).toContain('@searchable');
            expect(meilisearch.map((d) => d.name)).toContain('@filterable');
        });

        it('getByPlugin returns empty for unknown plugin', () => {
            expect(registry.getByPlugin('unknown')).toEqual([]);
        });
    });

    describe('getDocumentation', () => {
        it('returns documentation for all directives', () => {
            registry.register({
                name: '@unique',
                pluginName: '@yamajs/kernel',
                targets: ['field'],
                description: 'Adds unique constraint',
            });

            const docs = registry.getDocumentation();
            expect(docs).toHaveLength(1);
            expect(docs[0]).toEqual({
                name: '@unique',
                plugin: '@yamajs/kernel',
                targets: ['field'],
                description: 'Adds unique constraint',
                argsSchema: undefined,
            });
        });
    });
});
