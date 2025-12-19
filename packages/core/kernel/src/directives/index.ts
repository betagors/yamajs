/**
 * Yama Directives Module
 *
 * Provides the complete directive system for Yama plugins:
 * - Directive parsing (@directive(args))
 * - Directive registry (registration, conflict detection)
 * - Core directives (@unique, @index, @default, etc.)
 * - Directive execution (field/schema hooks, transforms, validation)
 */

// Types
export type {
    ParsedDirective,
    DirectiveArgs,
    DirectiveTarget,
    DirectiveDefinition,
    DirectiveFieldContext,
    DirectiveSchemaContext,
    DirectiveTransformContext,
    DirectiveValidateContext,
    DirectiveValidationResult,
    DirectiveExecutionOptions,
    PluginSchemaConfig,
    PluginSchemaOptionsDefinition,
    SchemaWithPluginConfig,
    FieldWithDirectives,
} from '../../../../../../../../core/kernel/src/directives/types.js';

// Parser
export {
    extractDirectives,
    parseDirectiveArgs,
    parseNamedArgs,
    parseValue,
    isValidDirectiveName,
    extractPluginFromDirective,
    type DirectiveExtractionResult,
} from '../../../../../../../../core/kernel/src/directives/parser.js';

// Registry
export {
    DirectiveRegistry,
    directiveRegistry,
    registerDirective,
    getDirective,
} from '../../../../../../../../core/kernel/src/directives/registry.js';

// Core directives
export {
    registerCoreDirectives,
    getCoreDirectiveNames,
} from '../../../../../../../../core/kernel/src/directives/core-directives.js';

// Executor
export {
    executeFieldDirectives,
    executeSchemaDirectives,
    executeTransformDirectives,
    executeValidateDirectives,
    createTransformPipeline,
    createValidationFunction,
} from '../../../../../../../../core/kernel/src/directives/executor.js';
