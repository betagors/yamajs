/**
 * Yama Directive Executor
 *
 * Executes directive hooks during schema loading and request processing.
 * Handles the directive pipeline (left-to-right execution).
 */

import type { FieldType } from '../types/types.js';
import type {
    ParsedDirective,
    DirectiveFieldContext,
    DirectiveSchemaContext,
    DirectiveTransformContext,
    DirectiveValidateContext,
    DirectiveValidationResult,
    DirectiveExecutionOptions,
} from './types.js';
import { directiveRegistry } from './registry.js';

/**
 * Default logger for directive execution
 */
const defaultLogger = {
    debug: () => { },
    info: () => { },
    warn: console.warn,
    error: console.error,
};

/**
 * Execute field-level directive hooks
 *
 * Directives are executed in order (left-to-right).
 * Each directive can modify the field type or attach metadata.
 */
export async function executeFieldDirectives(
    fieldName: string,
    fieldType: FieldType,
    schemaName: string,
    directives: ParsedDirective[],
    schema: Record<string, unknown>,
    options: DirectiveExecutionOptions = {}
): Promise<{
    fieldType: FieldType;
    meta: Record<string, unknown>;
    errors: string[];
    warnings: string[];
}> {
    const logger = options.logger || defaultLogger;
    const meta: Record<string, unknown> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const directive of directives) {
        const definition = directiveRegistry.get(directive.name);

        if (!definition) {
            if (options.skipUnknown) {
                warnings.push(`Unknown directive: ${directive.name}`);
                continue;
            } else {
                errors.push(`Unknown directive: ${directive.name}`);
                if (options.failFast) break;
                continue;
            }
        }

        // Validate target
        const targetValidation = directiveRegistry.validateTarget(directive.name, 'field');
        if (!targetValidation.valid) {
            errors.push(...(targetValidation.errors || []));
            if (options.failFast) break;
            continue;
        }

        // Execute onField hook
        if (definition.onField) {
            const context: DirectiveFieldContext = {
                fieldName,
                fieldType,
                schemaName,
                args: directive.args,
                meta,
                getSchema: () => schema,
            };

            try {
                await Promise.resolve(definition.onField(context));
                logger.debug?.(
                    `Executed directive ${directive.name} on ${schemaName}.${fieldName}`
                );
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                errors.push(`Directive ${directive.name} failed: ${message}`);
                if (options.failFast) break;
            }
        }
    }

    return { fieldType, meta, errors, warnings };
}

/**
 * Execute schema-level directive hooks
 */
export async function executeSchemaDirectives(
    schemaName: string,
    schema: Record<string, unknown>,
    directives: ParsedDirective[],
    options: DirectiveExecutionOptions = {}
): Promise<{
    meta: Record<string, unknown>;
    errors: string[];
    warnings: string[];
}> {
    const logger = options.logger || defaultLogger;
    const meta: Record<string, unknown> = {};
    const errors: string[] = [];
    const warnings: string[] = [];

    for (const directive of directives) {
        const definition = directiveRegistry.get(directive.name);

        if (!definition) {
            if (options.skipUnknown) {
                warnings.push(`Unknown directive: ${directive.name}`);
                continue;
            } else {
                errors.push(`Unknown directive: ${directive.name}`);
                if (options.failFast) break;
                continue;
            }
        }

        // Validate target
        const targetValidation = directiveRegistry.validateTarget(directive.name, 'schema');
        if (!targetValidation.valid) {
            errors.push(...(targetValidation.errors || []));
            if (options.failFast) break;
            continue;
        }

        // Execute onSchema hook
        if (definition.onSchema) {
            const context: DirectiveSchemaContext = {
                schemaName,
                schema,
                args: directive.args,
                meta,
            };

            try {
                await Promise.resolve(definition.onSchema(context));
                logger.debug?.(`Executed directive ${directive.name} on schema ${schemaName}`);
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                errors.push(`Directive ${directive.name} failed: ${message}`);
                if (options.failFast) break;
            }
        }
    }

    return { meta, errors, warnings };
}

/**
 * Execute transform directives on a field value (during request processing)
 *
 * Transforms are executed in pipeline order (left-to-right).
 */
export async function executeTransformDirectives(
    value: unknown,
    fieldName: string,
    schemaName: string,
    directives: ParsedDirective[],
    operation: 'create' | 'update' | 'read',
    requestData: Record<string, unknown>,
    options: DirectiveExecutionOptions = {}
): Promise<{
    value: unknown;
    errors: string[];
}> {
    const logger = options.logger || defaultLogger;
    const errors: string[] = [];
    let currentValue = value;

    for (const directive of directives) {
        const definition = directiveRegistry.get(directive.name);

        if (!definition || !definition.transform) {
            continue;
        }

        const context: DirectiveTransformContext = {
            fieldName,
            schemaName,
            operation,
            requestData,
            logger,
        };

        try {
            currentValue = await Promise.resolve(
                definition.transform(currentValue, directive.args, context)
            );
            logger.debug?.(
                `Transformed ${schemaName}.${fieldName} with ${directive.name}`
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`Transform ${directive.name} failed on ${fieldName}: ${message}`);
            if (options.failFast) break;
        }
    }

    return { value: currentValue, errors };
}

/**
 * Execute validation directives on a field value
 *
 * Returns validation errors if any directive's validate hook fails.
 */
export async function executeValidateDirectives(
    value: unknown,
    fieldName: string,
    schemaName: string,
    directives: ParsedDirective[],
    operation: 'create' | 'update',
    requestData: Record<string, unknown>,
    options: DirectiveExecutionOptions = {}
): Promise<DirectiveValidationResult> {
    const errors: string[] = [];

    for (const directive of directives) {
        const definition = directiveRegistry.get(directive.name);

        if (!definition || !definition.validate) {
            continue;
        }

        const context: DirectiveValidateContext = {
            fieldName,
            schemaName,
            operation,
            requestData,
        };

        try {
            const result = await Promise.resolve(
                definition.validate(value, directive.args, context)
            );

            if (result === false) {
                errors.push(`Validation failed for ${fieldName} (${directive.name})`);
            } else if (typeof result === 'string') {
                errors.push(result);
            }

            if (errors.length > 0 && options.failFast) break;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            errors.push(`Validation error in ${directive.name} on ${fieldName}: ${message}`);
            if (options.failFast) break;
        }
    }

    return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
    };
}

/**
 * Create a transform pipeline function for a field
 *
 * Returns a function that can be called with a value to run the full
 * directive transform pipeline.
 */
export function createTransformPipeline(
    fieldName: string,
    schemaName: string,
    directives: ParsedDirective[],
    operation: 'create' | 'update' | 'read'
): (
    value: unknown,
    requestData: Record<string, unknown>
) => Promise<unknown> {
    return async (value, requestData) => {
        const { value: transformed, errors } = await executeTransformDirectives(
            value,
            fieldName,
            schemaName,
            directives,
            operation,
            requestData,
            { failFast: true }
        );

        if (errors.length > 0) {
            throw new Error(errors.join('; '));
        }

        return transformed;
    };
}

/**
 * Create a validation function for a field
 */
export function createValidationFunction(
    fieldName: string,
    schemaName: string,
    directives: ParsedDirective[]
): (
    value: unknown,
    operation: 'create' | 'update',
    requestData: Record<string, unknown>
) => Promise<DirectiveValidationResult> {
    return async (value, operation, requestData) => {
        return executeValidateDirectives(
            value,
            fieldName,
            schemaName,
            directives,
            operation,
            requestData
        );
    };
}
