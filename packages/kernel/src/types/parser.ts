import { BaseType, FieldType } from './types.js';

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
export class TypeParser {
  /**
   * Parse field type from YAML string
   */
  static parse(typeStr: string): FieldType {
    let nullable = true;
    let array = false;
    let str = typeStr.trim();
    let defaultValue: any = undefined;
    
    // Extract default value first (e.g., "timestamp = now" or "string = 'default'")
    // Look for " = " pattern, but be careful not to match it inside parentheses
    let defaultFn: string | undefined = undefined;
    const defaultMatch = str.match(/\s+=\s+(.+)$/);
    if (defaultMatch) {
      const defaultValueStr = defaultMatch[1].trim();
      // Check if it's a function call (with or without parentheses)
      if (defaultValueStr.match(/^\w+\(\)$/) || ['now', 'gen_uuid', 'uuid', 'random', 'current_timestamp'].includes(defaultValueStr.toLowerCase())) {
        defaultFn = defaultValueStr.replace('()', '');
      } else {
        defaultValue = this.parseValue(defaultValueStr);
      }
      // Remove default value from string before further parsing
      str = str.substring(0, defaultMatch.index).trim();
    }
    
    // Check for required (!) - can be at end or before modifiers
    const exclamationIndex = str.indexOf('!');
    if (exclamationIndex !== -1) {
      nullable = false;
      // Remove the ! and any surrounding whitespace
      str = (str.slice(0, exclamationIndex) + str.slice(exclamationIndex + 1)).trim();
    }
    
    // Check for explicit nullable (?) - can be at end or before modifiers
    const questionIndex = str.indexOf('?');
    if (questionIndex !== -1) {
      nullable = true;
      // Remove the ? and any surrounding whitespace
      str = (str.slice(0, questionIndex) + str.slice(questionIndex + 1)).trim();
    }
    
    // Check for array type
    if (str.includes('[]')) {
      array = true;
      str = str.replace('[]', '');
    }
    
    // Parse modifiers (readonly, unique, etc.)
    const modifiers = this.parseModifiers(str);
    str = modifiers.remaining.trim();
    
    // Parse type with parameters - now the string should be clean (no default, no !, no modifiers)
    // Match: typeName or typeName(params)
    const match = str.match(/^(\w+)(?:\((.*?)\))?$/);
    if (!match) {
      throw new Error(`Invalid type syntax: ${typeStr}. Remaining string after parsing: "${str}"`);
    }
    
    const [, baseType, params] = match;
    
    const fieldType: FieldType = {
      type: baseType as BaseType,
      nullable,
      array,
      ...modifiers.fields,
    };
    
    // Set default value or default function if we extracted one
    if (defaultFn !== undefined) {
      fieldType.defaultFn = defaultFn;
    } else if (defaultValue !== undefined) {
      fieldType.default = defaultValue;
    }
    
    if (params) {
      this.parseParameters(baseType as BaseType, params, fieldType);
    }
    
    return fieldType;
  }
  
  /**
   * Parse field modifiers (readonly, unique, indexed, etc.)
   * Also filters out relation modifiers (cascade, etc.) that are handled at entity level
   */
  private static parseModifiers(str: string): { remaining: string; fields: Partial<FieldType> } {
    const fields: Partial<FieldType> = {};
    const parts = str.split(/\s+/);
    const remainingParts: string[] = [];
    
    for (const part of parts) {
      // Field type modifiers
      if (part === 'readonly') {
        fields.readonly = true;
      } else if (part === 'unique') {
        fields.unique = true;
      } else if (part === 'indexed') {
        fields.indexed = true;
      } else if (part === 'writeOnly') {
        fields.writeOnly = true;
      } else if (part === 'sensitive') {
        fields.sensitive = true;
      } else if (part === 'generated') {
        fields.generated = true;
      } else if (part === 'autoUpdate') {
        fields.autoUpdate = true;
      } else if (part.match(/^default:(.+)$/)) {
        const match = part.match(/^default:(.+)$/);
        if (match) {
          fields.default = this.parseDefaultValue(match[1]);
        }
      } 
      // Relation modifiers (filter out but don't store - handled at entity level)
      else if (part === 'cascade' || part === 'onDelete' || part === 'onUpdate') {
        // These are relation modifiers, filter them out but don't store in FieldType
        // They're handled separately when processing inline relations
      }
      // Keep everything else (like type names, etc.)
      else {
        remainingParts.push(part);
      }
    }
    
    return {
      remaining: remainingParts.join(' '),
      fields,
    };
  }
  
  /**
   * Parse type-specific parameters
   */
  private static parseParameters(
    type: BaseType,
    params: string,
    fieldType: FieldType
  ): void {
    switch (type) {
      case 'string':
      case 'text':
      case 'email':
      case 'url':
      case 'slug':
      case 'phone':
        this.parseStringParams(params, fieldType);
        break;
        
      case 'int':
      case 'int8':
      case 'int16':
      case 'int32':
      case 'int64':
      case 'uint':
        this.parseIntParams(params, fieldType);
        break;
        
      case 'decimal':
      case 'money':
        this.parseDecimalParams(params, fieldType);
        break;
        
      case 'enum':
        this.parseEnumParams(params, fieldType);
        break;
        
      case 'date':
      case 'time':
      case 'timestamp':
      case 'timestamptz':
      case 'timestamplocal':
        this.parseDateTimeParams(params, fieldType);
        break;
        
      case 'binary':
      case 'base64':
        this.parseBinaryParams(params, fieldType);
        break;
        
      default:
        // Try to parse as generic params
        this.parseGenericParams(params, fieldType);
    }
  }
  
  /**
   * Parse string type parameters
   */
  private static parseStringParams(params: string, fieldType: FieldType): void {
    // Check for range: string(3..50)
    const rangeMatch = params.match(/^(\d+)\.\.(\d+)$/);
    if (rangeMatch) {
      fieldType.minLength = parseInt(rangeMatch[1]);
      fieldType.maxLength = parseInt(rangeMatch[2]);
      return;
    }
    
    // Check for single length: string(100)
    const lengthMatch = params.match(/^\d+$/);
    if (lengthMatch) {
      fieldType.length = parseInt(params);
      fieldType.maxLength = parseInt(params);
      return;
    }
    
    // Check for regex pattern: string(/^[a-z]+$/)
    const patternMatch = params.match(/^\/(.+)\/$/);
    if (patternMatch) {
      fieldType.pattern = patternMatch[1];
      return;
    }
    
    // Parse key-value params: string(minLength: 3, maxLength: 50)
    this.parseKeyValueParams(params, fieldType);
  }
  
  /**
   * Parse integer type parameters
   */
  private static parseIntParams(params: string, fieldType: FieldType): void {
    // Check for range: int(0..100)
    const rangeMatch = params.match(/^(-?\d+)\.\.(-?\d+)$/);
    if (rangeMatch) {
      fieldType.min = parseInt(rangeMatch[1]);
      fieldType.max = parseInt(rangeMatch[2]);
      return;
    }
    
    // Parse key-value params: int(min: 0, max: 100)
    this.parseKeyValueParams(params, fieldType);
  }
  
  /**
   * Parse decimal/money type parameters
   */
  private static parseDecimalParams(params: string, fieldType: FieldType): void {
    // Check for precision, scale: decimal(10, 2)
    const precisionMatch = params.match(/^(\d+)\s*,\s*(\d+)(?:\s*,\s*(.+))?$/);
    if (precisionMatch) {
      fieldType.precision = parseInt(precisionMatch[1]);
      fieldType.scale = parseInt(precisionMatch[2]);
      
      // Additional params after precision and scale
      if (precisionMatch[3]) {
        this.parseKeyValueParams(precisionMatch[3], fieldType);
      }
      return;
    }
    
    // money(usd) or money(usd, min: 0)
    const currencyMatch = params.match(/^([a-z]{3})(?:\s*,\s*(.+))?$/i);
    if (currencyMatch) {
      fieldType.currency = currencyMatch[1].toUpperCase();
      
      // Default precision and scale for money
      fieldType.precision = 19;
      fieldType.scale = 4;
      
      if (currencyMatch[2]) {
        this.parseKeyValueParams(currencyMatch[2], fieldType);
      }
      return;
    }
    
    this.parseKeyValueParams(params, fieldType);
  }
  
  /**
   * Parse enum type parameters
   */
  private static parseEnumParams(params: string, fieldType: FieldType): void {
    // enum(draft, published, archived)
    fieldType.enumValues = params.split(',').map(v => v.trim().replace(/^["']|["']$/g, ''));
  }
  
  /**
   * Parse date/time type parameters
   */
  private static parseDateTimeParams(params: string, fieldType: FieldType): void {
    // date(2024-01-01..) or date(..2010-01-01) or date(2020-01-01..2025-01-01)
    const rangeMatch = params.match(/^([^.]+)?\.\.([^.]+)?$/);
    if (rangeMatch) {
      if (rangeMatch[1]) fieldType.min = rangeMatch[1];
      if (rangeMatch[2]) fieldType.max = rangeMatch[2];
      return;
    }
    
    this.parseKeyValueParams(params, fieldType);
  }
  
  /**
   * Parse binary type parameters
   */
  private static parseBinaryParams(params: string, fieldType: FieldType): void {
    // binary(10mb) or binary(100kb..5mb)
    const rangeMatch = params.match(/^([^.]+)\.\.([^.]+)$/);
    if (rangeMatch) {
      fieldType.min = this.parseSize(rangeMatch[1]) as any;
      fieldType.max = this.parseSize(rangeMatch[2]) as any;
      return;
    }
    
    const sizeMatch = params.match(/^(\d+)(kb|mb|gb)?$/i);
    if (sizeMatch) {
      fieldType.max = this.parseSize(params) as any;
      return;
    }
    
    this.parseKeyValueParams(params, fieldType);
  }
  
  /**
   * Parse size string (e.g., "10mb", "100kb")
   */
  private static parseSize(size: string): number {
    const match = size.match(/^(\d+)(kb|mb|gb)?$/i);
    if (!match) return 0;
    
    const value = parseInt(match[1]);
    const unit = (match[2] || '').toLowerCase();
    
    switch (unit) {
      case 'kb': return value * 1024;
      case 'mb': return value * 1024 * 1024;
      case 'gb': return value * 1024 * 1024 * 1024;
      default: return value;
    }
  }
  
  /**
   * Parse generic key-value parameters
   */
  private static parseKeyValueParams(params: string, fieldType: FieldType): void {
    // Parse: min: 0, max: 100, default: 50
    const pairs = params.split(',').map(p => p.trim());
    
    for (const pair of pairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex === -1) continue;
      
      const key = pair.substring(0, colonIndex).trim();
      const value = pair.substring(colonIndex + 1).trim();
      
      switch (key) {
        case 'min':
          fieldType.min = this.parseValue(value);
          break;
        case 'max':
          fieldType.max = this.parseValue(value);
          break;
        case 'minLength':
          fieldType.minLength = parseInt(value);
          break;
        case 'maxLength':
          fieldType.maxLength = parseInt(value);
          break;
        case 'length':
          fieldType.length = parseInt(value);
          break;
        case 'precision':
          fieldType.precision = parseInt(value);
          break;
        case 'scale':
          fieldType.scale = parseInt(value);
          break;
        case 'default':
          fieldType.default = this.parseValue(value);
          break;
        case 'pattern':
          fieldType.pattern = value.replace(/^["']|["']$/g, '');
          break;
        case 'minItems':
          fieldType.minItems = parseInt(value);
          break;
        case 'maxItems':
          fieldType.maxItems = parseInt(value);
          break;
      }
    }
  }
  
  /**
   * Parse generic parameters (fallback)
   */
  private static parseGenericParams(params: string, fieldType: FieldType): void {
    this.parseKeyValueParams(params, fieldType);
  }
  
  /**
   * Parse a value (number, boolean, string, or function)
   */
  private static parseValue(value: string): any {
    // Remove quotes
    value = value.replace(/^["']|["']$/g, '');
    
    // Try to parse as number
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }
    
    // Boolean
    if (value === 'true') return true;
    if (value === 'false') return false;
    
    // Null
    if (value === 'null') return null;
    
    // Function calls (e.g., now(), gen_uuid())
    if (value.match(/^\w+\(\)$/)) {
      return { defaultFn: value.replace('()', '') };
    }
    
    // String
    return value;
  }
  
  /**
   * Parse default value
   */
  private static parseDefaultValue(value: string): any {
    const trimmed = value.trim();
    
    // Function calls with parentheses (e.g., "now()", "gen_uuid()")
    if (trimmed.match(/^\w+\(\)$/)) {
      return { defaultFn: trimmed.replace('()', '') };
    }
    
    // Function calls without parentheses (e.g., "now", "gen_uuid")
    // Common default function names
    const functionNames = ['now', 'gen_uuid', 'uuid', 'random', 'current_timestamp'];
    if (functionNames.includes(trimmed.toLowerCase())) {
      return { defaultFn: trimmed };
    }
    
    // Use parseValue for everything else
    return this.parseValue(trimmed);
  }
  
  /**
   * Parse expanded field definition (object syntax)
   */
  static parseExpanded(fieldDef: Record<string, any>): FieldType {
    const fieldType: FieldType = {
      type: fieldDef.type || 'string',
      nullable: fieldDef.required !== false && fieldDef.nullable !== false,
      array: fieldDef.array === true || (fieldDef.items !== undefined),
    };
    
    // Copy all properties
    if (fieldDef.length !== undefined) fieldType.length = fieldDef.length;
    if (fieldDef.precision !== undefined) fieldType.precision = fieldDef.precision;
    if (fieldDef.scale !== undefined) fieldType.scale = fieldDef.scale;
    if (fieldDef.currency !== undefined) fieldType.currency = fieldDef.currency;
    if (fieldDef.enum !== undefined || fieldDef.values !== undefined) {
      fieldType.enumValues = fieldDef.enum || fieldDef.values;
    }
    if (fieldDef.pattern !== undefined) fieldType.pattern = fieldDef.pattern;
    if (fieldDef.min !== undefined) fieldType.min = fieldDef.min;
    if (fieldDef.max !== undefined) fieldType.max = fieldDef.max;
    if (fieldDef.minLength !== undefined) fieldType.minLength = fieldDef.minLength;
    if (fieldDef.maxLength !== undefined) fieldType.maxLength = fieldDef.maxLength;
    if (fieldDef.minItems !== undefined) fieldType.minItems = fieldDef.minItems;
    if (fieldDef.maxItems !== undefined) fieldType.maxItems = fieldDef.maxItems;
    if (fieldDef.default !== undefined) fieldType.default = fieldDef.default;
    if (fieldDef.defaultFn !== undefined) fieldType.defaultFn = fieldDef.defaultFn;
    if (fieldDef.unique === true) fieldType.unique = true;
    if (fieldDef.indexed === true) fieldType.indexed = true;
    if (fieldDef.readonly === true) fieldType.readonly = true;
    if (fieldDef.writeOnly === true) fieldType.writeOnly = true;
    if (fieldDef.sensitive === true) fieldType.sensitive = true;
    if (fieldDef.generated === true) fieldType.generated = true;
    if (fieldDef.autoUpdate === true) fieldType.autoUpdate = true;
    if (fieldDef.dbType !== undefined) fieldType.dbType = fieldDef.dbType;
    if (fieldDef.description !== undefined) fieldType.description = fieldDef.description;
    
    return fieldType;
  }
}
