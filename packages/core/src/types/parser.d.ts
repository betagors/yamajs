import { FieldType } from './types.js';
/**
 * Type Parser
 *
 * Parses YAML field type syntax into structured FieldType objects.
 *
 * Examples:
 *   "string" -> { type: 'string', nullable: true }
 *   "string!" -> { type: 'string', nullable: false }
 *   "string?" -> { type: 'string', nullable: true }
 *   "string(100)" -> { type: 'string', nullable: true, length: 100 }
 *   "string(3..50)" -> { type: 'string', nullable: true, minLength: 3, maxLength: 50 }
 *   "int(0..100)" -> { type: 'int', nullable: true, min: 0, max: 100 }
 *   "decimal(10, 2)" -> { type: 'decimal', nullable: true, precision: 10, scale: 2 }
 *   "email!" -> { type: 'email', nullable: false }
 *   "string[]" -> { type: 'string', nullable: true, array: true }
 *   "int[](max: 10)" -> { type: 'int', nullable: true, array: true, maxItems: 10 }
 *   "enum(draft, published, archived)" -> { type: 'enum', nullable: true, enumValues: [...] }
 */
export declare class TypeParser {
    /**
     * Parse field type from YAML string
     */
    static parse(typeStr: string): FieldType;
    /**
     * Parse field modifiers (readonly, unique, indexed, etc.)
     * Also filters out relation modifiers (cascade, etc.) that are handled at entity level
     */
    private static parseModifiers;
    /**
     * Parse type-specific parameters
     */
    private static parseParameters;
    /**
     * Parse string type parameters
     */
    private static parseStringParams;
    /**
     * Parse integer type parameters
     */
    private static parseIntParams;
    /**
     * Parse decimal/money type parameters
     */
    private static parseDecimalParams;
    /**
     * Parse enum type parameters
     */
    private static parseEnumParams;
    /**
     * Parse date/time type parameters
     */
    private static parseDateTimeParams;
    /**
     * Parse binary type parameters
     */
    private static parseBinaryParams;
    /**
     * Parse size string (e.g., "10mb", "100kb")
     */
    private static parseSize;
    /**
     * Parse generic key-value parameters
     */
    private static parseKeyValueParams;
    /**
     * Parse generic parameters (fallback)
     */
    private static parseGenericParams;
    /**
     * Parse a value (number, boolean, string, or function)
     */
    private static parseValue;
    /**
     * Parse default value
     */
    private static parseDefaultValue;
    /**
     * Parse expanded field definition (object syntax)
     */
    static parseExpanded(fieldDef: Record<string, any>): FieldType;
}
//# sourceMappingURL=parser.d.ts.map