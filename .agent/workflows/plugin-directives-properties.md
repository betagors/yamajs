---
description: Implementing Plugin Directives and Properties ($$) System
---

# Plugin Directives & Properties Implementation Plan

## Status: ✅ IMPLEMENTED

This workflow documents the complete Directives (`@directive`) and Plugin Properties (`$$:`) system for Yama plugins as specified in the crystallization document.

**Implementation Completed:** All phases have been implemented.

## Phase 1: Core Types & Interfaces (~1-2 days)

### 1.1 Create Directive Types
Create `packages/core/src/directives/types.ts`:

```typescript
/**
 * Parsed directive from field type string
 */
export interface ParsedDirective {
  name: string;           // e.g., "@unique", "@searchable"
  args: DirectiveArgs;    // Parsed arguments
  raw: string;            // Original string for error messages
}

/**
 * Directive arguments (can be positional or named)
 */
export type DirectiveArgs = {
  _value?: any;           // Positional value: @mock("faker.email")
  enabled?: boolean;      // Boolean shorthand: @searchable
  [key: string]: any;     // Named args: @encrypted(algorithm: "argon2")
};

/**
 * Directive target types
 */
export type DirectiveTarget = 'field' | 'schema' | 'both';

/**
 * Directive definition registered by plugins
 */
export interface DirectiveDefinition {
  /** Directive name (with @) */
  name: string;
  
  /** Plugin that registered this directive */
  pluginName: string;
  
  /** Where can this directive be used? */
  targets: DirectiveTarget[];
  
  /** JSON Schema for argument validation */
  argsSchema?: Record<string, unknown>;
  
  /** Description for documentation */
  description?: string;
  
  /** Field-level hook - called when directive is on a field */
  onField?(context: DirectiveFieldContext): void | Promise<void>;
  
  /** Schema-level hook - called when directive is on a schema */
  onSchema?(context: DirectiveSchemaContext): void | Promise<void>;
  
  /** Transform hook - called during request processing */
  transform?(value: any, args: DirectiveArgs, context: DirectiveTransformContext): any | Promise<any>;
  
  /** Validate hook - called during validation */
  validate?(value: any, args: DirectiveArgs, context: DirectiveValidateContext): boolean | string | Promise<boolean | string>;
}

/**
 * Context for field-level directive processing
 */
export interface DirectiveFieldContext {
  fieldName: string;
  fieldType: FieldType;
  schemaName: string;
  args: DirectiveArgs;
  meta: Record<string, unknown>;  // Plugin can attach metadata
}

/**
 * Context for schema-level directive processing
 */
export interface DirectiveSchemaContext {
  schemaName: string;
  schema: SchemaDefinition;
  args: DirectiveArgs;
  meta: Record<string, unknown>;
}

/**
 * Context for transform hooks (during request processing)
 */
export interface DirectiveTransformContext {
  fieldName: string;
  schemaName: string;
  operation: 'create' | 'update' | 'read';
  request: unknown;
}

/**
 * Context for validation hooks
 */
export interface DirectiveValidateContext {
  fieldName: string;
  schemaName: string;
  operation: 'create' | 'update';
}
```

### 1.2 Create Plugin Properties Types
Update `packages/core/src/plugins/base.ts` with schema options:

```typescript
/**
 * Schema-level plugin configuration (from $$ block)
 */
export interface PluginSchemaOptions {
  /** JSON Schema for validating schema-level plugin config */
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
}

// Add to YamaPlugin interface:
export interface YamaPlugin extends PluginLifecycle, PluginRelationships {
  // ... existing fields ...
  
  /**
   * Directives this plugin provides
   */
  directives?: Record<string, DirectiveDefinition>;
  
  /**
   * Schema-level options this plugin accepts (for $$ block)
   */
  schemaOptions?: PluginSchemaOptions;
  
  /**
   * Called after schemas are loaded, with $$ configs
   */
  onSchemaLoaded?(schemas: Record<string, SchemaWithPluginConfig>, context: PluginContext): void | Promise<void>;
}
```

## Phase 2: Directive Parser (~1-2 days)

### 2.1 Update Type Parser to Extract Directives
Modify `packages/core/src/types/parser.ts`:

```typescript
/**
 * Parse result with directives
 */
export interface ParseResult {
  fieldType: FieldType;
  directives: ParsedDirective[];
}

/**
 * Parse field type from YAML string, extracting directives
 */
static parseWithDirectives(typeStr: string): ParseResult {
  // 1. Extract directives first (anything starting with @)
  const directives: ParsedDirective[] = [];
  let remaining = typeStr;
  
  // Match directives: @name or @name(args)
  const directiveRegex = /@(\w+(?:\.\w+)?)(?:\(([^)]*)\))?/g;
  let match;
  
  while ((match = directiveRegex.exec(typeStr)) !== null) {
    const [full, name, argsStr] = match;
    directives.push({
      name: `@${name}`,
      args: argsStr ? this.parseDirectiveArgs(argsStr) : { enabled: true },
      raw: full,
    });
    remaining = remaining.replace(full, '').trim();
  }
  
  // 2. Parse the remaining type string normally
  const fieldType = this.parse(remaining);
  
  return { fieldType, directives };
}

/**
 * Parse directive arguments
 */
private static parseDirectiveArgs(argsStr: string): DirectiveArgs {
  argsStr = argsStr.trim();
  
  // Empty args
  if (!argsStr) return { enabled: true };
  
  // Boolean shorthand: @directive(false)
  if (argsStr === 'false') return { enabled: false };
  if (argsStr === 'true') return { enabled: true };
  
  // Array: @enum(["a", "b", "c"])
  if (argsStr.startsWith('[')) {
    try {
      return { values: JSON.parse(argsStr) };
    } catch {
      // Not valid JSON, treat as single value
    }
  }
  
  // Single quoted/double-quoted value: @mock("faker.email")
  if ((argsStr.startsWith('"') && argsStr.endsWith('"')) ||
      (argsStr.startsWith("'") && argsStr.endsWith("'"))) {
    return { _value: argsStr.slice(1, -1) };
  }
  
  // Named arguments: algorithm: "argon2", cost: 12
  if (argsStr.includes(':')) {
    const args: DirectiveArgs = {};
    // Parse YAML-like key: value pairs
    const pairs = this.parseNamedArgs(argsStr);
    for (const [key, value] of Object.entries(pairs)) {
      args[key] = value;
    }
    return args;
  }
  
  // Single unquoted value
  return { _value: this.parseValue(argsStr) };
}

/**
 * Parse named arguments (key: value, key2: value2)
 */
private static parseNamedArgs(argsStr: string): Record<string, any> {
  // Handle nested objects and arrays carefully
  const result: Record<string, any> = {};
  // ... implementation using state machine for proper nesting
  return result;
}
```

### 2.2 Create Directive Registry
Create `packages/core/src/directives/registry.ts`:

```typescript
/**
 * Registry for all registered directives
 */
export class DirectiveRegistry {
  private directives = new Map<string, DirectiveDefinition>();
  private pluginDirectives = new Map<string, Set<string>>();
  
  /**
   * Register a directive from a plugin
   */
  register(directive: DirectiveDefinition): void {
    const existing = this.directives.get(directive.name);
    if (existing && existing.pluginName !== directive.pluginName) {
      throw new Error(
        `PluginConflictError: Directive ${directive.name} registered by multiple plugins:\n` +
        `  - ${existing.pluginName}\n` +
        `  - ${directive.pluginName}\n\n` +
        `Use namespaced directives to resolve:\n` +
        `  @${existing.pluginName.split('/').pop()}.${directive.name.slice(1)} or ` +
        `@${directive.pluginName.split('/').pop()}.${directive.name.slice(1)}`
      );
    }
    
    this.directives.set(directive.name, directive);
    
    // Track which plugin registered which directives
    if (!this.pluginDirectives.has(directive.pluginName)) {
      this.pluginDirectives.set(directive.pluginName, new Set());
    }
    this.pluginDirectives.get(directive.pluginName)!.add(directive.name);
  }
  
  /**
   * Get a directive by name (supports namespaced lookups)
   */
  get(name: string): DirectiveDefinition | undefined {
    return this.directives.get(name);
  }
  
  /**
   * Validate directive can be used on target
   */
  validateTarget(name: string, target: DirectiveTarget): void {
    const directive = this.directives.get(name);
    if (!directive) {
      throw new Error(`Unknown directive: ${name}`);
    }
    
    if (!directive.targets.includes(target) && !directive.targets.includes('both')) {
      throw new Error(
        `DirectiveError: ${name} cannot be used on ${target}s\n` +
        `  Valid targets: ${directive.targets.join(', ')}`
      );
    }
  }
}

export const directiveRegistry = new DirectiveRegistry();
```

## Phase 3: $$ Block Parser (~1 day)

### 3.1 Update Schema Parser
Modify schema parsing to extract and validate `$$` blocks:

```typescript
// In normalizeSchemaDefinition:
export function normalizeSchemaDefinition(schemaDef: SchemaDefinition): NormalizedSchema {
  // ... existing field parsing ...
  
  // Extract $$ block (plugin configurations)
  let pluginConfigs: Record<string, Record<string, unknown>> | undefined;
  
  if ('$$' in schemaDef) {
    pluginConfigs = schemaDef.$$ as Record<string, Record<string, unknown>>;
    // Validate against registered plugins
    for (const [pluginKey, config] of Object.entries(pluginConfigs)) {
      const plugin = pluginRegistry.get(pluginKey);
      if (!plugin) {
        console.warn(
          `⚠️  Warning: Plugin '${pluginKey}' not found. Config ignored.\n` +
          `     Install with: npm install @yamajs/plugin-${pluginKey}`
        );
      } else if (plugin.schemaOptions) {
        // Validate config against plugin's schema
        validateSchemaConfig(pluginKey, config, plugin.schemaOptions);
      }
    }
  }
  
  return {
    fields,
    computed: schemaDef.computed,
    variants: schemaDef.variants,
    database: schemaDef.database,
    $$: pluginConfigs,
  };
}
```

## Phase 4: Core Directives (~1 day)

### 4.1 Register Built-in Directives
Create `packages/core/src/directives/core-directives.ts`:

```typescript
import { directiveRegistry } from './registry.js';

/**
 * Core directives built into Yama
 */
export function registerCoreDirectives(): void {
  // @unique - Database uniqueness constraint
  directiveRegistry.register({
    name: '@unique',
    pluginName: '@yamajs/core',
    targets: ['field'],
    description: 'Adds a unique constraint to the field',
    onField({ fieldType }) {
      fieldType.unique = true;
    },
  });
  
  // @index - Database index
  directiveRegistry.register({
    name: '@index',
    pluginName: '@yamajs/core',
    targets: ['field'],
    description: 'Adds a database index to the field',
    onField({ fieldType }) {
      fieldType.indexed = true;
    },
  });
  
  // @default - Default value
  directiveRegistry.register({
    name: '@default',
    pluginName: '@yamajs/core',
    targets: ['field'],
    argsSchema: {
      type: 'object',
      properties: {
        _value: { description: 'Default value' },
      },
    },
    onField({ fieldType, args }) {
      if (args._value !== undefined) {
        fieldType.default = args._value;
      }
    },
  });
  
  // @enum - Enum validation
  directiveRegistry.register({
    name: '@enum',
    pluginName: '@yamajs/core',
    targets: ['field'],
    argsSchema: {
      type: 'object',
      properties: {
        values: { type: 'array', items: { type: 'string' } },
      },
    },
    onField({ fieldType, args }) {
      if (args.values) {
        fieldType.enumValues = args.values;
      }
    },
  });
  
  // @readonly - Read-only field
  directiveRegistry.register({
    name: '@readonly',
    pluginName: '@yamajs/core',
    targets: ['field'],
    onField({ fieldType }) {
      fieldType.readonly = true;
    },
  });
  
  // @sensitive - Sensitive field (excluded from responses)
  directiveRegistry.register({
    name: '@sensitive',
    pluginName: '@yamajs/core',
    targets: ['field'],
    onField({ fieldType }) {
      fieldType.sensitive = true;
    },
  });
}
```

## Phase 5: Plugin Integration (~2 days)

### 5.1 Update Plugin Registry
Modify plugin loading to register directives:

```typescript
// In PluginRegistry.loadPlugin():
async loadPlugin(plugin: YamaPlugin, config: Record<string, unknown>) {
  // ... existing validation ...
  
  // Register plugin's directives
  if (plugin.directives) {
    for (const [name, definition] of Object.entries(plugin.directives)) {
      directiveRegistry.register({
        ...definition,
        name,
        pluginName: plugin.name,
      });
    }
  }
  
  // ... continue with init ...
}
```

### 5.2 Create definePlugin Helper
Create `packages/core/src/plugins/define.ts`:

```typescript
import type { YamaPlugin, DirectiveDefinition, PluginSchemaOptions } from './types.js';

/**
 * Helper to define a Yama plugin with full type safety
 */
export function definePlugin(definition: {
  name: string;
  version?: string;
  description?: string;
  
  // Dependencies
  requires?: string[];
  conflicts?: string[];
  
  // Configuration
  config?: Record<string, unknown>;  // JSON Schema
  
  // Directives
  directives?: Record<string, Omit<DirectiveDefinition, 'name' | 'pluginName'>>;
  
  // Schema options (for $$ block)
  schemaOptions?: PluginSchemaOptions;
  
  // Lifecycle
  onInit?(config: Record<string, unknown>, context: PluginContext): Promise<void> | void;
  onSchemaLoaded?(schemas: Record<string, any>, context: PluginContext): Promise<void> | void;
  onReady?(context: PluginContext): Promise<void> | void;
  onShutdown?(context: PluginContext): Promise<void> | void;
  
  // API extension
  extendAPI?(api: any, context: PluginContext): void;
  
  init(opts: Record<string, unknown>, context: PluginContext): Promise<any>;
}): YamaPlugin {
  return definition as YamaPlugin;
}
```

## Phase 6: JSON Schema Updates (~1 day)

### 6.1 Update yama.schema.json
Add directive pattern support and $$ block to schema:

```json
{
  "definitions": {
    "fieldWithDirectives": {
      "type": "string",
      "pattern": "^[a-z]+[\\w]*(!|\\?)?( @\\w+(?:\\([^)]*\\))?)*( = .+)?$",
      "description": "Field type with optional directives: string! @unique @index"
    },
    
    "schemaDefinition": {
      "type": "object",
      "properties": {
        "fields": {
          "type": "object",
          "additionalProperties": {
            "$ref": "#/definitions/fieldWithDirectives"
          }
        },
        "$$": {
          "type": "object",
          "description": "Plugin-specific schema configuration",
          "additionalProperties": {
            "type": "object"
          }
        }
      }
    }
  }
}
```

## Phase 7: Testing & Documentation (~1-2 days)

### 7.1 Unit Tests
- Directive parsing tests
- Argument parsing tests  
- Registry conflict detection tests
- $$ block validation tests

### 7.2 Integration Tests
- End-to-end plugin with directives
- Multiple plugins with schema options
- Conflict resolution tests

### 7.3 Documentation
- Update plugin development guide
- Add directive reference documentation
- Create example plugins

## Estimated Timeline

| Phase | Description | Duration |
|-------|-------------|----------|
| Phase 1 | Core Types & Interfaces | 1-2 days |
| Phase 2 | Directive Parser | 1-2 days |
| Phase 3 | $$ Block Parser | 1 day |
| Phase 4 | Core Directives | 1 day |
| Phase 5 | Plugin Integration | 2 days |
| Phase 6 | JSON Schema Updates | 1 day |
| Phase 7 | Testing & Documentation | 1-2 days |

**Total: ~9-12 days for complete implementation**

## File Structure

```
packages/core/src/
├── directives/
│   ├── index.ts           # Exports
│   ├── types.ts           # Type definitions
│   ├── parser.ts          # Directive argument parser
│   ├── registry.ts        # Directive registry
│   └── core-directives.ts # Built-in directives (@unique, @index, etc.)
├── plugins/
│   ├── base.ts            # Updated with directive/schemaOptions types
│   ├── define.ts          # definePlugin() helper
│   └── registry.ts        # Updated to register directives
└── types/
    └── parser.ts          # Updated to extract directives
```

## Commands

// turbo-all

1. Create directives folder:
```bash
mkdir -p packages/core/src/directives
```

2. Build and test:
```bash
pnpm -C packages/core build
pnpm -C packages/core test
```
