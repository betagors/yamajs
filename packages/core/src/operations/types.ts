import type { SchemaField } from "../schemas.js";

/**
 * Operation definition - can be shorthand (string or null) or full config (object)
 */
export type OperationDefinition = string | null | OperationConfig;

/**
 * Full operation configuration
 */
export interface OperationConfig {
  /**
   * Input schema definition
   * - String "id" = standard get-by-id input
   * - Object = custom input schema
   */
  input?: string | Record<string, SchemaField | string>;
  
  /**
   * Output schema name or inline definition
   * - String = schema name (e.g., "Post", "PostSummary[]")
   * - Object = inline schema with fields
   * - null = no response body (204)
   */
  output?: string | { fields: Record<string, SchemaField | string> } | null;
  
  /**
   * Parent entity for nested resources
   * e.g., "Post" for listComments creates /posts/{postId}/comments
   */
  parent?: string;
  
  /**
   * Custom handler path (only needed for complex logic)
   */
  handler?: string;
  
  /**
   * Lifecycle hooks for simple customization
   */
  hooks?: {
    beforeCreate?: string;
    afterCreate?: string;
    beforeUpdate?: string;
    afterUpdate?: string;
    beforeDelete?: string;
    afterDelete?: string;
  };
  
  /**
   * Auto-applied filter conditions
   */
  filter?: Record<string, unknown>;
  
  /**
   * Custom path override (overrides convention-based inference)
   */
  path?: string;
}

/**
 * Parsed operation with inferred metadata
 */
export interface ParsedOperation {
  name: string;
  config: OperationConfig;
  method: string;
  path: string;
  entity?: string; // Inferred entity name from operation name
  operationType: "list" | "get" | "create" | "update" | "delete" | "search" | "custom";
}

/**
 * Collection of operations
 */
export interface YamaOperations {
  [operationName: string]: OperationDefinition;
}
