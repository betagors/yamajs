import type { FieldType } from '../types/types.js';

/**
 * Variant configuration
 * Defines how to transform a base schema into a variant (create, update, response, etc.)
 */
export interface VariantConfig {
  /** Fields to exclude from this variant */
  exclude?: string[];
  
  /** Fields to include (if specified, only these fields are included) */
  pick?: string[];
  
  /** Override field definitions for this variant */
  override?: Record<string, FieldType | string>;
  
  /** Make all fields optional (for update variants) */
  partial?: boolean;
  
  /** Additional computed fields to include */
  include?: string[];
}

/**
 * Variant definitions for a schema
 */
export interface SchemaVariants {
  [variantName: string]: VariantConfig;
}

/**
 * Global variant defaults
 * Applied to all schemas unless overridden
 */
export interface GlobalVariantDefaults {
  [variantName: string]: VariantConfig;
}

/**
 * Variant result - a transformed schema
 */
export interface VariantSchema {
  fields: Record<string, FieldType>;
  computed?: Record<string, any>;
}

