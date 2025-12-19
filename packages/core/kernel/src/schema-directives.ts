/**
 * Enhanced Schema Parsing with Directive and Plugin Support
 *
 * This module extends the base schema parsing to support:
 * - Directives on fields: `email: string! @unique @index`
 * - Plugin configuration via $$ blocks
 * - Schema-level metadata
 */

import type { FieldType } from './types/types.js';
import type { SchemaField, SchemaDefinition, YamaSchemas } from './schemas.js';
import type {
    ParsedDirective,
    FieldWithDirectives,
    SchemaWithPluginConfig,
    PluginSchemaConfig,
} from './directives/types.js';
import { extractDirectives } from './directives/parser.js';
import { TypeParser } from './types/parser.js';

/**
 * Extended schema field with directive support
 */
export interface EnhancedSchemaField extends SchemaField {
    /** Directives applied to this field (in order of appearance) */
    directives?: ParsedDirective[];

    /** Metadata attached by directive hooks */
    meta?: Record<string, unknown>;
}

/**
 * Extended schema definition with plugin config ($$ block)
 */
export interface EnhancedSchemaDefinition extends SchemaDefinition {
    /** Plugin-specific configuration from $$ block */
    $$?: PluginSchemaConfig;
}

/**
 * Parse a field type string, extracting both the type and any directives
 *
 * @example
 * parseFieldWithDirectives("email", "string! @unique @index @mock(\"faker.email\")")
 * // Returns: {
 * //   type: "string",
 * //   required: true,
 * //   directives: [
 * //     { name: "@unique", args: { enabled: true } },
 * //     { name: "@index", args: { enabled: true } },
 * //     { name: "@mock", args: { _value: "faker.email" } }
 * //   ]
 * // }
 */
export function parseFieldWithDirectives(
    fieldName: string,
    fieldDef: string,
    availableSchemas?: Set<string>
): EnhancedSchemaField {
    // First extract all directives from the field string
    const { remaining, directives } = extractDirectives(fieldDef);

    // Parse the remaining type string using the existing TypeParser
    const parsedType = TypeParser.parse(remaining);

    // Convert FieldType to EnhancedSchemaField
    const field: EnhancedSchemaField = {
        type: parsedType.type as SchemaField['type'],
        required: !parsedType.nullable,
        default:
            parsedType.default ||
            (parsedType.defaultFn ? parsedType.defaultFn + '()' : undefined),
        minLength: parsedType.minLength,
        maxLength: parsedType.maxLength,
        min: typeof parsedType.min === 'number' ? parsedType.min : undefined,
        max: typeof parsedType.max === 'number' ? parsedType.max : undefined,
        pattern: parsedType.pattern,
        enum: parsedType.enumValues,
    };

    // Map type-specific formats
    if (parsedType.type === 'email') {
        field.type = 'string';
        field.format = 'email';
    } else if (parsedType.type === 'url') {
        field.type = 'string';
        field.format = 'uri';
    } else if (parsedType.type === 'date') {
        field.type = 'string';
        field.format = 'date';
    } else if (parsedType.type === 'time') {
        field.type = 'string';
        field.format = 'time';
    } else if (
        ['timestamp', 'timestamptz', 'timestamplocal', 'datetime'].includes(
            parsedType.type as string
        )
    ) {
        field.type = 'string';
        field.format = 'date-time';
    } else if (parsedType.type === 'text') {
        field.type = 'string';
    } else if (
        ['int', 'int8', 'int16', 'int32', 'int64', 'uint'].includes(parsedType.type as string)
    ) {
        field.type = 'integer';
    } else if (
        ['decimal', 'money', 'float', 'double'].includes(parsedType.type as string)
    ) {
        field.type = 'number';
    } else if (['json', 'jsonb'].includes(parsedType.type as string)) {
        field.type = 'object';
    } else if (parsedType.type === 'enum') {
        field.type = 'string';
        field.enum = parsedType.enumValues;
    }

    // Check for schema reference (capitalized names)
    const baseName = (parsedType.type as string).replace('[]', '');
    if (
        /^[A-Z][a-zA-Z0-9]*$/.test(baseName) &&
        (availableSchemas?.has(baseName) ?? true)
    ) {
        field.type = parsedType.array ? `${baseName}[]` : baseName;
    }

    // Attach directives if any
    if (directives.length > 0) {
        field.directives = directives;
    }

    return field;
}

/**
 * Normalize an enhanced schema definition
 * Parses shorthand field syntax and extracts $$ plugin configuration
 */
export function normalizeEnhancedSchema(
    schemaName: string,
    schemaDef: EnhancedSchemaDefinition | Record<string, unknown>
): SchemaWithPluginConfig {
    // Validate input
    if (!schemaDef || typeof schemaDef !== 'object' || schemaDef === null) {
        throw new Error(
            `Invalid schema definition for "${schemaName}": expected an object, but got ${typeof schemaDef}`
        );
    }

    // Must have fields property (or be a simple object with only string values)
    if (!('fields' in schemaDef)) {
        // Check if it's an object where all values are field definitions
        const allFieldDefs = Object.entries(schemaDef).every(
            ([key, val]) =>
                key === '$$' ||
                key === 'computed' ||
                key === 'database' ||
                typeof val === 'string' ||
                (typeof val === 'object' && val !== null)
        );

        if (!allFieldDefs) {
            throw new Error(
                `Invalid schema "${schemaName}": expected { fields: {...} } or field definitions`
            );
        }
    }

    // Extract $$ plugin configuration
    const pluginConfigs = schemaDef.$$ as PluginSchemaConfig | undefined;

    // Warn about unknown plugins (actual validation happens later when plugins are loaded)
    if (pluginConfigs) {
        for (const pluginKey of Object.keys(pluginConfigs)) {
            // This is just a parse-time check; actual plugin validation happens at load time
            if (typeof pluginConfigs[pluginKey] !== 'object') {
                console.warn(
                    `⚠️  Schema "${schemaName}": Plugin "${pluginKey}" config should be an object`
                );
            }
        }
    }

    // Parse fields
    const rawFields =
        'fields' in schemaDef
            ? (schemaDef.fields as Record<string, unknown>)
            : Object.fromEntries(
                Object.entries(schemaDef).filter(
                    ([key]) =>
                        !['$$', 'computed', 'database', 'table'].includes(key)
                )
            );

    const fields: Record<string, FieldWithDirectives> = {};
    const availableSchemas = new Set<string>(); // Would be populated with all schema names

    for (const [fieldName, fieldDef] of Object.entries(rawFields)) {
        // Skip reserved keys
        if (fieldName === '$$') continue;

        if (typeof fieldDef === 'string') {
            // String syntax with potential directives
            const parsed = parseFieldWithDirectives(fieldName, fieldDef, availableSchemas);

            fields[fieldName] = {
                type: {
                    type: parsed.type as string,
                    nullable: !parsed.required,
                    array: (parsed.type as string).endsWith('[]'),
                } as FieldType,
                directives: parsed.directives || [],
                meta: {},
            };
        } else if (fieldDef && typeof fieldDef === 'object') {
            // Object syntax - parse with TypeParser.parseExpanded
            const expandedField = fieldDef as Record<string, unknown>;
            const parsedType = TypeParser.parseExpanded(expandedField);

            // Check for directives in object form (future extension)
            const directives: ParsedDirective[] = [];
            if (expandedField.directives && Array.isArray(expandedField.directives)) {
                // Support: directives: ["@unique", "@index"]
                for (const dir of expandedField.directives) {
                    if (typeof dir === 'string') {
                        const { directives: parsed } = extractDirectives(dir);
                        directives.push(...parsed);
                    }
                }
            }

            fields[fieldName] = {
                type: parsedType,
                directives,
                meta: {},
            };
        } else {
            throw new Error(
                `Invalid field "${fieldName}" in schema "${schemaName}": ` +
                `expected string or object, got ${typeof fieldDef}`
            );
        }
    }

    return {
        name: schemaName,
        fields,
        pluginConfigs,
        computed: schemaDef.computed as Record<string, unknown> | undefined,
        database: schemaDef.database as Record<string, unknown> | undefined,
    };
}

/**
 * Normalize all schemas in a YamaSchemas collection
 */
export function normalizeAllSchemas(
    schemas: YamaSchemas | Record<string, unknown>
): Record<string, SchemaWithPluginConfig> {
    const result: Record<string, SchemaWithPluginConfig> = {};

    for (const [schemaName, schemaDef] of Object.entries(schemas)) {
        // Skip non-schema entries
        if (typeof schemaDef !== 'object' || schemaDef === null) {
            continue;
        }

        try {
            result[schemaName] = normalizeEnhancedSchema(
                schemaName,
                schemaDef as EnhancedSchemaDefinition
            );
        } catch (error) {
            throw new Error(
                `Failed to normalize schema "${schemaName}": ${error instanceof Error ? error.message : String(error)
                }`
            );
        }
    }

    return result;
}

/**
 * Get all plugin configurations from schemas
 * Returns a map of plugin name -> array of { schemaName, config }
 */
export function getPluginSchemaConfigs(
    schemas: Record<string, SchemaWithPluginConfig>
): Map<string, Array<{ schemaName: string; config: Record<string, unknown> }>> {
    const result = new Map<
        string,
        Array<{ schemaName: string; config: Record<string, unknown> }>
    >();

    for (const [schemaName, schema] of Object.entries(schemas)) {
        if (!schema.pluginConfigs) continue;

        for (const [pluginName, config] of Object.entries(schema.pluginConfigs)) {
            if (!result.has(pluginName)) {
                result.set(pluginName, []);
            }
            result.get(pluginName)!.push({ schemaName, config });
        }
    }

    return result;
}

/**
 * Extract all directives used across all schemas
 * Returns a set of directive names (e.g., "@unique", "@searchable")
 */
export function extractAllDirectives(
    schemas: Record<string, SchemaWithPluginConfig>
): Set<string> {
    const directives = new Set<string>();

    for (const schema of Object.values(schemas)) {
        for (const field of Object.values(schema.fields)) {
            for (const directive of field.directives) {
                directives.add(directive.name);
            }
        }
    }

    return directives;
}
