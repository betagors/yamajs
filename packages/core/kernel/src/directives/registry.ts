/**
 * Yama Directive Registry
 *
 * Central registry for all directives registered by core and plugins.
 * Handles conflict detection, namespacing, and validation.
 */

import type {
    DirectiveDefinition,
    DirectiveTarget,
    DirectiveValidationResult,
    ParsedDirective,
    DirectiveArgs,
} from '../../../../../../../../core/kernel/src/directives/types.js';

/**
 * Directive registry manages all registered directives
 */
export class DirectiveRegistry {
    /** All registered directives by name */
    private directives = new Map<string, DirectiveDefinition>();

    /** Directives grouped by plugin */
    private pluginDirectives = new Map<string, Set<string>>();

    /** Namespaced aliases (e.g., @clerk.email → @email) */
    private aliases = new Map<string, string>();

    /**
     * Register a directive from a plugin
     *
     * @throws Error if directive conflicts with existing registration from different plugin
     */
    register(directive: DirectiveDefinition): void {
        const { name, pluginName } = directive;

        // Validate directive name format
        if (!name.startsWith('@')) {
            throw new Error(
                `Invalid directive name: "${name}". Directive names must start with @`
            );
        }

        // Check for conflicts
        const existing = this.directives.get(name);
        if (existing && existing.pluginName !== pluginName) {
            const existingShort = existing.pluginName.split('/').pop() || existing.pluginName;
            const newShort = pluginName.split('/').pop() || pluginName;

            throw new Error(
                `PluginConflictError: Directive ${name} registered by multiple plugins:\n` +
                `  - ${existing.pluginName}\n` +
                `  - ${pluginName}\n\n` +
                `Use namespaced directives to resolve:\n` +
                `  @${existingShort}.${name.slice(1)} or @${newShort}.${name.slice(1)}`
            );
        }

        // Register the directive
        this.directives.set(name, directive);

        // Also register namespaced version
        const shortPluginName = pluginName.split('/').pop()?.replace(/^plugin-/, '') || pluginName;
        const namespacedName = `@${shortPluginName}.${name.slice(1)}`;
        this.directives.set(namespacedName, directive);
        this.aliases.set(namespacedName, name);

        // Track by plugin
        if (!this.pluginDirectives.has(pluginName)) {
            this.pluginDirectives.set(pluginName, new Set());
        }
        this.pluginDirectives.get(pluginName)!.add(name);
    }

    /**
     * Unregister all directives for a plugin
     */
    unregister(pluginName: string): void {
        const directives = this.pluginDirectives.get(pluginName);
        if (!directives) return;

        for (const name of Array.from(directives)) {
            this.directives.delete(name);

            // Also remove namespaced version
            const shortPluginName = pluginName.split('/').pop()?.replace(/^plugin-/, '') || pluginName;
            const namespacedName = `@${shortPluginName}.${name.slice(1)}`;
            this.directives.delete(namespacedName);
            this.aliases.delete(namespacedName);
        }

        this.pluginDirectives.delete(pluginName);
    }

    /**
     * Get a directive by name
     *
     * Supports both direct names (@unique) and namespaced (@clerk.unique)
     */
    get(name: string): DirectiveDefinition | undefined {
        return this.directives.get(name);
    }

    /**
     * Check if a directive is registered
     */
    has(name: string): boolean {
        return this.directives.has(name);
    }

    /**
     * Get all directives registered by a plugin
     */
    getByPlugin(pluginName: string): DirectiveDefinition[] {
        const names = this.pluginDirectives.get(pluginName);
        if (!names) return [];

        return Array.from(names)
            .map((name) => this.directives.get(name))
            .filter((d): d is DirectiveDefinition => d !== undefined);
    }

    /**
     * Get all registered directives
     */
    getAll(): DirectiveDefinition[] {
        // Filter out aliases to avoid duplicates
        return Array.from(this.directives.entries())
            .filter(([name]) => !this.aliases.has(name))
            .map(([, def]) => def);
    }

    /**
     * Validate that a directive can be used on the specified target
     */
    validateTarget(name: string, target: DirectiveTarget): DirectiveValidationResult {
        const directive = this.directives.get(name);

        if (!directive) {
            return {
                valid: false,
                errors: [`Unknown directive: ${name}`],
            };
        }

        if (!directive.targets.includes(target) && !directive.targets.includes('both')) {
            return {
                valid: false,
                errors: [
                    `DirectiveError: ${name} cannot be used on ${target}s\n` +
                    `  Valid targets: ${directive.targets.join(', ')}\n\n` +
                    (target === 'schema'
                        ? `  Did you mean to use it on a field?`
                        : `  Did you mean to apply it at the schema level?`),
                ],
            };
        }

        return { valid: true };
    }

    /**
     * Validate directive arguments against schema
     */
    validateArgs(
        name: string,
        args: DirectiveArgs
    ): DirectiveValidationResult {
        const directive = this.directives.get(name);

        if (!directive) {
            return {
                valid: false,
                errors: [`Unknown directive: ${name}`],
            };
        }

        // If no schema defined, all args are valid
        if (!directive.argsSchema) {
            return { valid: true };
        }

        // Basic validation against schema
        // TODO: Use Ajv for full JSON Schema validation
        const errors: string[] = [];
        const schema = directive.argsSchema as Record<string, unknown>;

        if (schema.properties) {
            const properties = schema.properties as Record<
                string,
                Record<string, unknown>
            >;

            for (const [key, propSchema] of Object.entries(properties)) {
                const value = args[key];
                const propType = (propSchema as Record<string, unknown>).type;

                if (value !== undefined && propType) {
                    const actualType = Array.isArray(value) ? 'array' : typeof value;
                    if (actualType !== propType && propType !== 'any') {
                        errors.push(
                            `${name}: Argument "${key}" expected ${propType}, got ${actualType}`
                        );
                    }
                }
            }
        }

        if (schema.required && Array.isArray(schema.required)) {
            for (const key of schema.required) {
                if (args[key] === undefined) {
                    errors.push(`${name}: Missing required argument "${key}"`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
        };
    }

    /**
     * Validate a list of parsed directives
     */
    validateDirectives(
        directives: ParsedDirective[],
        target: DirectiveTarget
    ): DirectiveValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        for (const directive of directives) {
            // Check if directive exists
            if (!this.has(directive.name)) {
                warnings.push(
                    `Unknown directive: ${directive.name}. ` +
                    `This may be from a plugin that is not installed.`
                );
                continue;
            }

            // Validate target
            const targetResult = this.validateTarget(directive.name, target);
            if (!targetResult.valid && targetResult.errors) {
                errors.push(...targetResult.errors);
            }

            // Validate args
            const argsResult = this.validateArgs(directive.name, directive.args);
            if (!argsResult.valid && argsResult.errors) {
                errors.push(...argsResult.errors);
            }
        }

        return {
            valid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
        };
    }

    /**
     * Get directive documentation
     */
    getDocumentation(): Array<{
        name: string;
        plugin: string;
        targets: DirectiveTarget[];
        description?: string;
        argsSchema?: Record<string, unknown>;
    }> {
        return this.getAll().map((d) => ({
            name: d.name,
            plugin: d.pluginName,
            targets: d.targets,
            description: d.description,
            argsSchema: d.argsSchema,
        }));
    }

    /**
     * Clear all registered directives (for testing)
     */
    clear(): void {
        this.directives.clear();
        this.pluginDirectives.clear();
        this.aliases.clear();
    }
}

/**
 * Global directive registry instance
 */
export const directiveRegistry = new DirectiveRegistry();

/**
 * Helper to register a directive (uses global registry)
 */
export function registerDirective(directive: DirectiveDefinition): void {
    directiveRegistry.register(directive);
}

/**
 * Helper to get a directive (uses global registry)
 */
export function getDirective(name: string): DirectiveDefinition | undefined {
    return directiveRegistry.get(name);
}
