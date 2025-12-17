/**
 * Yama Core Directives
 *
 * Built-in directives that are always available without plugins.
 * These map directly to schema/field type properties.
 */

import { directiveRegistry } from './registry.js';
import type { DirectiveDefinition } from './types.js';

/**
 * Core directives built into Yama
 */
const coreDirectives: Omit<DirectiveDefinition, 'pluginName'>[] = [
    // =========================================================================
    // Database Constraints
    // =========================================================================
    {
        name: '@unique',
        targets: ['field'],
        description: 'Adds a unique constraint to the database column',
        onField({ fieldType }) {
            fieldType.unique = true;
        },
    },

    {
        name: '@index',
        targets: ['field'],
        description: 'Creates a database index on the column',
        onField({ fieldType }) {
            fieldType.indexed = true;
        },
    },

    {
        name: '@primary',
        targets: ['field'],
        description: 'Marks this field as the primary key',
        onField({ fieldType, meta }) {
            meta.primaryKey = true;
            fieldType.unique = true;
        },
    },

    // =========================================================================
    // Default Values
    // =========================================================================
    {
        name: '@default',
        targets: ['field'],
        description: 'Sets a default value for the field',
        argsSchema: {
            type: 'object',
            properties: {
                _value: { description: 'Default value or function name (e.g., "now", "uuid")' },
            },
        },
        onField({ fieldType, args }) {
            const value = args._value;

            // Check for function defaults
            const functionNames = ['now', 'uuid', 'gen_uuid', 'random', 'current_timestamp'];
            if (typeof value === 'string' && functionNames.includes(value.toLowerCase())) {
                fieldType.defaultFn = value;
            } else {
                fieldType.default = value;
            }
        },
    },

    // =========================================================================
    // Type Constraints
    // =========================================================================
    {
        name: '@enum',
        targets: ['field'],
        description: 'Restricts field to specific allowed values',
        argsSchema: {
            type: 'object',
            properties: {
                values: { type: 'array', items: { type: 'string' } },
                _value: { type: 'array' },
            },
        },
        onField({ fieldType, args }) {
            const values = args.values || args._value;
            if (Array.isArray(values)) {
                fieldType.enumValues = values.map(String);
            }
        },
    },

    {
        name: '@min',
        targets: ['field'],
        description: 'Sets minimum value/length constraint',
        argsSchema: {
            type: 'object',
            properties: {
                _value: { type: 'number' },
            },
        },
        onField({ fieldType, args }) {
            const value = args._value;
            if (typeof value === 'number') {
                // For strings, this is minLength; for numbers, it's min
                if (['string', 'text', 'email', 'url', 'slug'].includes(fieldType.type as string)) {
                    fieldType.minLength = value;
                } else {
                    fieldType.min = value;
                }
            }
        },
    },

    {
        name: '@max',
        targets: ['field'],
        description: 'Sets maximum value/length constraint',
        argsSchema: {
            type: 'object',
            properties: {
                _value: { type: 'number' },
            },
        },
        onField({ fieldType, args }) {
            const value = args._value;
            if (typeof value === 'number') {
                // For strings, this is maxLength; for numbers, it's max
                if (['string', 'text', 'email', 'url', 'slug'].includes(fieldType.type as string)) {
                    fieldType.maxLength = value;
                } else {
                    fieldType.max = value;
                }
            }
        },
    },

    {
        name: '@pattern',
        targets: ['field'],
        description: 'Validates field value against a regex pattern',
        argsSchema: {
            type: 'object',
            properties: {
                _value: { type: 'string', description: 'Regex pattern' },
            },
        },
        onField({ fieldType, args }) {
            if (typeof args._value === 'string') {
                fieldType.pattern = args._value;
            }
        },
    },

    // =========================================================================
    // Field Behavior
    // =========================================================================
    {
        name: '@readonly',
        targets: ['field'],
        description: 'Field can only be set on creation, not updated',
        onField({ fieldType }) {
            fieldType.readonly = true;
        },
    },

    {
        name: '@writeOnly',
        targets: ['field'],
        description: 'Field is not included in read responses (e.g., password)',
        onField({ fieldType }) {
            fieldType.writeOnly = true;
        },
    },

    {
        name: '@sensitive',
        targets: ['field'],
        description: 'Field contains sensitive data, excluded from logs and default responses',
        onField({ fieldType }) {
            fieldType.sensitive = true;
        },
    },

    {
        name: '@generated',
        targets: ['field'],
        description: 'Field is auto-generated and should not be user-provided',
        onField({ fieldType }) {
            fieldType.generated = true;
            fieldType.readonly = true;
        },
    },

    {
        name: '@autoUpdate',
        targets: ['field'],
        description: 'Field is automatically updated on record updates (e.g., updatedAt)',
        onField({ fieldType }) {
            fieldType.autoUpdate = true;
        },
    },

    // =========================================================================
    // Documentation
    // =========================================================================
    {
        name: '@description',
        targets: ['field', 'schema'],
        description: 'Adds documentation/description to the field or schema',
        argsSchema: {
            type: 'object',
            properties: {
                _value: { type: 'string' },
            },
        },
        onField({ fieldType, args }) {
            if (typeof args._value === 'string') {
                fieldType.description = args._value;
            }
        },
        onSchema({ meta, args }) {
            if (typeof args._value === 'string') {
                meta.description = args._value;
            }
        },
    },

    {
        name: '@deprecated',
        targets: ['field', 'schema'],
        description: 'Marks field or schema as deprecated',
        argsSchema: {
            type: 'object',
            properties: {
                _value: { type: 'string', description: 'Deprecation message' },
            },
        },
        onField({ meta, args }) {
            meta.deprecated = true;
            if (typeof args._value === 'string') {
                meta.deprecationReason = args._value;
            }
        },
        onSchema({ meta, args }) {
            meta.deprecated = true;
            if (typeof args._value === 'string') {
                meta.deprecationReason = args._value;
            }
        },
    },

    // =========================================================================
    // Aliases for common patterns
    // =========================================================================
    {
        name: '@required',
        targets: ['field'],
        description: 'Marks field as non-nullable (same as !)',
        onField({ fieldType }) {
            fieldType.nullable = false;
        },
    },

    {
        name: '@optional',
        targets: ['field'],
        description: 'Marks field as nullable (same as ?)',
        onField({ fieldType }) {
            fieldType.nullable = true;
        },
    },

    {
        name: '@hidden',
        targets: ['field'],
        description: 'Field is excluded from API responses',
        onField({ fieldType }) {
            fieldType.writeOnly = true;
        },
    },
];

/**
 * Register all core directives
 */
export function registerCoreDirectives(): void {
    for (const directive of coreDirectives) {
        directiveRegistry.register({
            ...directive,
            pluginName: '@yamajs/core',
        });
    }
}

/**
 * Get list of core directive names
 */
export function getCoreDirectiveNames(): string[] {
    return coreDirectives.map((d) => d.name);
}
