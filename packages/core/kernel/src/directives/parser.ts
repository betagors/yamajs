/**
 * Yama Directive Parser
 *
 * Parses directive syntax from field type strings.
 *
 * Examples:
 *   "@unique" → { name: "@unique", args: { enabled: true } }
 *   "@mock("faker.email")" → { name: "@mock", args: { _value: "faker.email" } }
 *   "@encrypted(algorithm: "argon2", cost: 12)" → { name: "@encrypted", args: { algorithm: "argon2", cost: 12 } }
 *   "@upload(folder: "avatars", resize: { width: 200 })" → { name: "@upload", args: { folder: "avatars", resize: { width: 200 } } }
 */

import type { ParsedDirective, DirectiveArgs } from '../../../../../../../../core/kernel/src/directives/types.js';

/**
 * Result of extracting directives from a type string
 */
export interface DirectiveExtractionResult {
    /** Remaining type string after directive extraction */
    remaining: string;

    /** Parsed directives in order of appearance */
    directives: ParsedDirective[];
}

/**
 * Extract all directives from a type string
 *
 * @param typeStr - Full type string (e.g., "string! @unique @index @mock("faker.email")")
 * @returns Remaining type string and parsed directives
 */
export function extractDirectives(typeStr: string): DirectiveExtractionResult {
    const directives: ParsedDirective[] = [];
    let remaining = typeStr.trim();

    // Match directives: @name or @name(args) or @namespace.name(args)
    // Use a state machine approach to handle nested parentheses correctly
    let i = 0;
    while (i < remaining.length) {
        // Find next @ symbol
        const atIndex = remaining.indexOf('@', i);
        if (atIndex === -1) break;

        // Check if this is a valid directive start (not inside quotes)
        const beforeAt = remaining.slice(0, atIndex);
        if (isInsideQuotes(beforeAt)) {
            i = atIndex + 1;
            continue;
        }

        // Parse directive name (supports namespaced: @plugin.directive)
        const nameMatch = remaining.slice(atIndex).match(/^@([\w.]+)/);
        if (!nameMatch) {
            i = atIndex + 1;
            continue;
        }

        const directiveName = `@${nameMatch[1]}`;
        let endIndex = atIndex + nameMatch[0].length;
        let argsStr = '';

        // Check for arguments in parentheses
        if (remaining[endIndex] === '(') {
            const closeIndex = findMatchingParen(remaining, endIndex);
            if (closeIndex === -1) {
                throw new Error(
                    `DirectiveParseError: Unclosed parenthesis in directive ${directiveName}\n` +
                    `  at: ${remaining.slice(atIndex, atIndex + 50)}...`
                );
            }
            argsStr = remaining.slice(endIndex + 1, closeIndex);
            endIndex = closeIndex + 1;
        }

        // Parse the directive
        const directive: ParsedDirective = {
            name: directiveName,
            args: parseDirectiveArgs(argsStr),
            raw: remaining.slice(atIndex, endIndex),
        };

        directives.push(directive);

        // Remove directive from remaining string
        remaining = (remaining.slice(0, atIndex) + remaining.slice(endIndex)).trim();
        // Don't advance i since we removed content
    }

    return {
        remaining: remaining.trim(),
        directives,
    };
}

/**
 * Parse directive arguments string
 *
 * Handles:
 * - Empty: "" → { enabled: true }
 * - Boolean: "false" → { enabled: false }
 * - Single value: "faker.email" → { _value: "faker.email" }
 * - Quoted: '"faker.email"' → { _value: "faker.email" }
 * - Array: '["a", "b"]' → { values: ["a", "b"] }
 * - Named: 'key: "value", num: 42' → { key: "value", num: 42 }
 * - Nested: 'folder: "x", opts: { a: 1 }' → { folder: "x", opts: { a: 1 } }
 */
export function parseDirectiveArgs(argsStr: string): DirectiveArgs {
    argsStr = argsStr.trim();

    // Empty args = enabled boolean
    if (!argsStr) {
        return { enabled: true };
    }

    // Boolean shorthand
    if (argsStr === 'false') return { enabled: false };
    if (argsStr === 'true') return { enabled: true };

    // Try to parse as JSON first (handles arrays and objects)
    if (argsStr.startsWith('[') || argsStr.startsWith('{')) {
        try {
            const parsed = JSON.parse(argsStr);
            if (Array.isArray(parsed)) {
                return { values: parsed };
            }
            return parsed;
        } catch {
            // Not valid JSON, fall through to other parsing
        }
    }

    // Single quoted or double-quoted value
    if (
        (argsStr.startsWith('"') && argsStr.endsWith('"')) ||
        (argsStr.startsWith("'") && argsStr.endsWith("'"))
    ) {
        return { _value: argsStr.slice(1, -1) };
    }

    // Check for named arguments (contains :)
    if (argsStr.includes(':')) {
        return parseNamedArgs(argsStr);
    }

    // Single unquoted value
    return { _value: parseValue(argsStr) };
}

/**
 * Parse named arguments (YAML-like syntax)
 *
 * Examples:
 * - 'key: "value"' → { key: "value" }
 * - 'a: 1, b: "two"' → { a: 1, b: "two" }
 * - 'opts: { nested: true }' → { opts: { nested: true } }
 */
export function parseNamedArgs(argsStr: string): DirectiveArgs {
    const result: DirectiveArgs = {};
    let current = argsStr.trim();

    while (current.length > 0) {
        // Find key
        const colonIndex = findNextColon(current);
        if (colonIndex === -1) break;

        const key = current.slice(0, colonIndex).trim();
        current = current.slice(colonIndex + 1).trim();

        // Find value end (comma or end of string, respecting nesting)
        const { value, remaining } = extractValue(current);
        result[key] = parseValue(value);
        current = remaining;

        // Skip comma
        if (current.startsWith(',')) {
            current = current.slice(1).trim();
        }
    }

    return result;
}

/**
 * Find the next colon that's not inside quotes or braces
 */
function findNextColon(str: string): number {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (inString) {
            if (char === stringChar && str[i - 1] !== '\\') {
                inString = false;
            }
        } else {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            } else if (char === '{' || char === '[' || char === '(') {
                depth++;
            } else if (char === '}' || char === ']' || char === ')') {
                depth--;
            } else if (char === ':' && depth === 0) {
                return i;
            }
        }
    }

    return -1;
}

/**
 * Extract a value from the start of a string, handling nesting
 */
function extractValue(str: string): { value: string; remaining: string } {
    let depth = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (inString) {
            if (char === stringChar && str[i - 1] !== '\\') {
                inString = false;
            }
        } else {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            } else if (char === '{' || char === '[' || char === '(') {
                depth++;
            } else if (char === '}' || char === ']' || char === ')') {
                depth--;
            } else if (char === ',' && depth === 0) {
                return {
                    value: str.slice(0, i).trim(),
                    remaining: str.slice(i).trim(),
                };
            }
        }
    }

    return {
        value: str.trim(),
        remaining: '',
    };
}

/**
 * Parse a value string into its proper type
 */
export function parseValue(value: string): unknown {
    value = value.trim();

    // Empty
    if (!value) return undefined;

    // Quoted string
    if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
    ) {
        return value.slice(1, -1);
    }

    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;

    // Null
    if (value === 'null') return null;

    // Number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
        return parseFloat(value);
    }

    // Array
    if (value.startsWith('[') && value.endsWith(']')) {
        try {
            return JSON.parse(value);
        } catch {
            // Not valid JSON, keep as string
        }
    }

    // Object
    if (value.startsWith('{') && value.endsWith('}')) {
        try {
            return JSON.parse(value);
        } catch {
            // Not valid JSON, try to parse as YAML-like
            const inner = value.slice(1, -1).trim();
            if (inner.includes(':')) {
                return parseNamedArgs(inner);
            }
        }
    }

    // Plain string
    return value;
}

/**
 * Find matching closing parenthesis
 */
function findMatchingParen(str: string, openIndex: number): number {
    let depth = 1;
    let inString = false;
    let stringChar = '';

    for (let i = openIndex + 1; i < str.length; i++) {
        const char = str[i];

        if (inString) {
            if (char === stringChar && str[i - 1] !== '\\') {
                inString = false;
            }
        } else {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            } else if (char === '(') {
                depth++;
            } else if (char === ')') {
                depth--;
                if (depth === 0) {
                    return i;
                }
            }
        }
    }

    return -1;
}

/**
 * Check if position is inside quotes
 */
function isInsideQuotes(str: string): boolean {
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < str.length; i++) {
        const char = str[i];

        if (inString) {
            if (char === stringChar && str[i - 1] !== '\\') {
                inString = false;
            }
        } else {
            if (char === '"' || char === "'") {
                inString = true;
                stringChar = char;
            }
        }
    }

    return inString;
}

/**
 * Validate directive name format
 */
export function isValidDirectiveName(name: string): boolean {
    // Must start with @ followed by word chars, optional .namespace
    return /^@[\w]+(\.[\w]+)?$/.test(name);
}

/**
 * Extract plugin name from namespaced directive
 *
 * @example
 * extractPluginFromDirective("@clerk.email") // "clerk"
 * extractPluginFromDirective("@unique") // undefined
 */
export function extractPluginFromDirective(name: string): string | undefined {
    const match = name.match(/^@([\w]+)\.([\w]+)$/);
    return match ? match[1] : undefined;
}
