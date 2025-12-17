/**
 * Relation Type Detection and Parsing
 * 
 * Handles detection and parsing of relation types in YAML schema:
 * - User       -> Optional relation to User
 * - User!      -> Required relation to User
 * - User[]     -> Array of User (has-many)
 * - User[]!    -> Required array of User
 * - User?      -> Explicitly optional relation
 */

import { scalarRegistry } from './scalars.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Relation type kinds
 */
export type RelationKind =
    | 'belongs-to'    // user: User (many-to-one)
    | 'has-one'       // profile: Profile (one-to-one)
    | 'has-many'      // posts: Post[] (one-to-many)
    | 'many-to-many'; // tags: Tag[] through:post_tags

/**
 * Parsed relation type
 */
export interface ParsedRelationType {
    /** Target model name */
    target: string;

    /** Whether this is an array relation */
    isArray: boolean;

    /** Whether the relation is required (non-nullable) */
    required: boolean;

    /** Inferred relation kind */
    kind: RelationKind;

    /** Through table for many-to-many */
    through?: string;

    /** Cascade options */
    onDelete?: 'cascade' | 'set-null' | 'restrict' | 'no-action';
    onUpdate?: 'cascade' | 'set-null' | 'restrict' | 'no-action';

    /** Foreign key field name (if specified) */
    foreignKey?: string;

    /** Referenced field name (if specified, defaults to 'id') */
    references?: string;
}

/**
 * Result of type classification
 */
export interface TypeClassification {
    /** Type category */
    category: 'scalar' | 'relation' | 'array' | 'enum';

    /** Is array type */
    isArray: boolean;

    /** Is required (non-nullable) */
    required: boolean;

    /** Base type name (without modifiers) */
    baseName: string;

    /** For relations: parsed relation details */
    relation?: ParsedRelationType;

    /** For enums: enum values */
    enumValues?: string[];
}

// ============================================================================
// Detection Utilities
// ============================================================================

/**
 * Regex to match model/relation names (PascalCase)
 * Must start with uppercase letter
 */
const MODEL_NAME_REGEX = /^[A-Z][a-zA-Z0-9]*$/;

/**
 * Regex to parse type string with modifiers
 * Captures: name, array brackets, nullable/required modifier
 */
const TYPE_PATTERN = /^([A-Za-z][A-Za-z0-9]*)(\[\])?([?!])?$/;

/**
 * Check if a type name looks like a relation (PascalCase model name)
 */
export function isRelationTypeName(name: string): boolean {
    return MODEL_NAME_REGEX.test(name);
}

/**
 * Check if a type string represents a relation
 * Returns false for known scalar types
 */
export function isRelationType(typeStr: string, knownModels?: Set<string>): boolean {
    // Remove modifiers
    const baseName = extractBaseName(typeStr);

    // Check if it's a known scalar
    if (scalarRegistry.has(baseName)) {
        return false;
    }

    // Check if it's a known model
    if (knownModels?.has(baseName)) {
        return true;
    }

    // Default: check if PascalCase (convention for model names)
    return isRelationTypeName(baseName);
}

/**
 * Extract base type name without modifiers ([], ?, !)
 */
export function extractBaseName(typeStr: string): string {
    return typeStr
        .replace(/\[\]$/, '')
        .replace(/[?!]$/, '')
        .replace(/\[\]$/, '')  // Handle Post[]? case
        .trim();
}

/**
 * Check if a type string is an array type
 */
export function isArrayType(typeStr: string): boolean {
    return typeStr.includes('[]');
}

/**
 * Check if a type string is required (!)
 */
export function isRequiredType(typeStr: string): boolean {
    return typeStr.includes('!');
}

/**
 * Check if a type string is nullable (? or no modifier)
 */
export function isNullableType(typeStr: string): boolean {
    return typeStr.includes('?') || !typeStr.includes('!');
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parse a complete type string into classification
 */
export function classifyType(typeStr: string, knownModels?: Set<string>): TypeClassification {
    const trimmed = typeStr.trim();

    // Handle enum type specially
    if (trimmed.startsWith('enum(') || trimmed.includes('@enum')) {
        const enumMatch = trimmed.match(/enum\(([^)]+)\)/);
        const enumValues = enumMatch
            ? enumMatch[1].split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''))
            : [];

        return {
            category: 'enum',
            isArray: false,
            required: trimmed.includes('!'),
            baseName: 'enum',
            enumValues,
        };
    }

    // Parse modifiers
    const isArray = isArrayType(trimmed);
    const required = isRequiredType(trimmed);
    const baseName = extractBaseName(trimmed);

    // Check if it's a scalar
    if (scalarRegistry.has(baseName)) {
        return {
            category: isArray ? 'array' : 'scalar',
            isArray,
            required,
            baseName,
        };
    }

    // Check if it's a relation
    if (isRelationType(trimmed, knownModels)) {
        const relation = parseRelationType(trimmed, knownModels);
        return {
            category: 'relation',
            isArray,
            required,
            baseName,
            relation,
        };
    }

    // Default: treat as scalar (might be custom type from plugin)
    return {
        category: isArray ? 'array' : 'scalar',
        isArray,
        required,
        baseName,
    };
}

/**
 * Parse a relation type string into detailed relation info
 */
export function parseRelationType(
    typeStr: string,
    _knownModels?: Set<string>
): ParsedRelationType {
    // Handle inline modifiers: "User! cascade" or "Post[] through:post_tags"
    const parts = typeStr.split(/\s+/);
    const typePart = parts[0];
    const modifierParts = parts.slice(1);

    // Parse type part
    const isArray = typePart.includes('[]');
    const required = typePart.includes('!');
    const target = extractBaseName(typePart);

    // Parse modifiers
    let through: string | undefined;
    let onDelete: ParsedRelationType['onDelete'];
    let onUpdate: ParsedRelationType['onUpdate'];
    let foreignKey: string | undefined;
    let references: string | undefined;

    for (const mod of modifierParts) {
        if (mod.startsWith('through:')) {
            through = mod.substring(8);
        } else if (mod.startsWith('foreignKey:') || mod.startsWith('fk:')) {
            foreignKey = mod.split(':')[1];
        } else if (mod.startsWith('references:') || mod.startsWith('ref:')) {
            references = mod.split(':')[1];
        } else if (mod === 'cascade') {
            onDelete = 'cascade';
            onUpdate = 'cascade';
        } else if (mod.startsWith('onDelete:')) {
            onDelete = mod.split(':')[1] as ParsedRelationType['onDelete'];
        } else if (mod.startsWith('onUpdate:')) {
            onUpdate = mod.split(':')[1] as ParsedRelationType['onUpdate'];
        }
    }

    // Infer relation kind
    let kind: RelationKind;
    if (through) {
        kind = 'many-to-many';
    } else if (isArray) {
        kind = 'has-many';
    } else {
        // Could be belongs-to or has-one, default to belongs-to
        kind = 'belongs-to';
    }

    return {
        target,
        isArray,
        required,
        kind,
        through,
        onDelete,
        onUpdate,
        foreignKey,
        references,
    };
}

/**
 * Validate that a relation target exists in known models
 */
export function validateRelationTarget(
    relation: ParsedRelationType,
    knownModels: Set<string>
): { valid: boolean; error?: string } {
    if (!knownModels.has(relation.target)) {
        return {
            valid: false,
            error: `Unknown relation target: ${relation.target}. Available models: ${Array.from(knownModels).join(', ')}`,
        };
    }
    return { valid: true };
}

/**
 * Get suggested foreign key name for a relation
 */
export function suggestForeignKeyName(relation: ParsedRelationType): string {
    // Convert PascalCase to snake_case + _id
    const snakeCase = relation.target
        .replace(/([A-Z])/g, '_$1')
        .toLowerCase()
        .replace(/^_/, '');
    return `${snakeCase}_id`;
}

/**
 * Get the default referenced field (usually 'id')
 */
export function getDefaultReferencedField(): string {
    return 'id';
}
