/**
 * Core Type System for YAMA
 * 
 * Provides a robust, schema-first type system with:
 * - 12+ core scalar types (v1.0)
 * - Runtime validation
 * - Relation type detection
 * - Inline constraints
 * - Database type mapping
 * - Plugin extensibility
 * 
 * v1.0 Core Scalars:
 * string, text, int, bigint, float, boolean,
 * uuid, timestamp, date, time, json, binary
 * 
 * Special: id (auto-generated uuid primary key)
 * Composite: relations, arrays, optional (?), required (!)
 */

// Base types and parser
export * from '../../../../../../../../../../../core/kernel/src/types/types.js';
export * from '../../../../../../../../../../../core/kernel/src/types/parser.js';

// Core scalar types with runtime validators
export * from '../../../../../../../../../../../core/kernel/src/types/scalars.js';

// Relation type detection
export * from '../../../../../../../../../../../core/kernel/src/types/relations.js';

// Database mapping
export * from '../../../../../../../../../../../core/kernel/src/types/mapper.js';

// Validation generation (CHECK constraints)
export * from '../../../../../../../../../../../core/kernel/src/types/validator.js';
