import type { ParsedOperation } from "./types.js";

/**
 * Pluralize a word (simple implementation)
 */
function pluralize(word: string): string {
  // Check if word is already plural (ends with 's' or 'es' but not singular words that end in 's')
  // Words that are already plural typically end with 's' (but not 'ss', 'us', 'is', 'as', 'os')
  // or 'es' (but not 'ies', 'ches', 'shes', 'xes', 'zes')
  if (word.length > 1) {
    // Already ends with 's' - check if it's likely already plural
    if (word.endsWith("s")) {
      // Exceptions: words ending in 'ss', 'us', 'is', 'as', 'os' might be singular
      // But for entity names, if it ends with 's', it's likely already plural
      // Check if it ends with 'es' (likely already plural)
      if (word.endsWith("es")) {
        // Check if it's a plural form (not 'ies', 'ches', 'shes', 'xes', 'zes')
        if (!word.endsWith("ies") && !word.endsWith("ches") && !word.endsWith("shes") && 
            !word.endsWith("xes") && !word.endsWith("zes")) {
          // Already plural (e.g., "posts", "authors", "publishedposts")
          return word;
        }
      } else {
        // Ends with 's' but not 'es' - likely already plural (e.g., "posts", "authors")
        // But check for singular words ending in 's' (like "class", "bus")
        // For entity names, if it ends with 's' and is not a known singular exception, assume plural
        const singularExceptions = ["class", "bus", "gas", "plus", "minus", "status", "focus", "virus"];
        if (!singularExceptions.includes(word.toLowerCase())) {
          // Likely already plural
          return word;
        }
      }
    }
  }
  
  // Apply pluralization rules for singular words
  if (word.endsWith("y")) {
    return word.slice(0, -1) + "ies";
  }
  if (word.endsWith("s") || word.endsWith("x") || word.endsWith("z") || 
      word.endsWith("ch") || word.endsWith("sh")) {
    return word + "es";
  }
  return word + "s";
}

/**
 * Convert camelCase/PascalCase to kebab-case
 * Examples: "PublishedPosts" -> "published-posts", "AuthorPosts" -> "author-posts"
 */
function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2') // Insert hyphen between lowercase and uppercase
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2') // Insert hyphen between consecutive capitals followed by lowercase
    .toLowerCase();
}

/**
 * Check if a word is already plural by checking the last segment
 */
function isLastWordPlural(words: string[]): boolean {
  if (words.length === 0) return false;
  const lastWord = words[words.length - 1];
  // Check if last word ends with 's' (and not in exceptions)
  if (lastWord.endsWith('s') && !lastWord.endsWith('ss')) {
    const singularExceptions = ["class", "bus", "gas", "plus", "minus", "status", "focus", "virus"];
    return !singularExceptions.includes(lastWord.toLowerCase());
  }
  return false;
}

/**
 * Convert entity name to path segment
 */
function entityNameToPath(entityName: string): string {
  // Convert to kebab-case and split into words
  const kebab = toKebabCase(entityName);
  const words = kebab.split('-');
  
  // Check if the last word is already plural
  if (isLastWordPlural(words)) {
    // Already plural, return as-is
    return kebab;
  }
  
  // Pluralize the last word only
  const lastWord = words[words.length - 1];
  const pluralizedLast = pluralize(lastWord);
  words[words.length - 1] = pluralizedLast;
  
  return words.join('-');
}

/**
 * Extract entity name from operation name
 * Examples:
 * - listPosts -> Post
 * - getPost -> Post
 * - createPost -> Post
 * - listPostComments -> Comment (with parent Post)
 */
export function extractEntityName(operationName: string): string | undefined {
  // Remove common prefixes
  const prefixes = ["list", "get", "create", "update", "delete", "search", "find"];
  
  for (const prefix of prefixes) {
    if (operationName.startsWith(prefix)) {
      const remainder = operationName.slice(prefix.length);
      // Convert camelCase to PascalCase
      return remainder.charAt(0).toUpperCase() + remainder.slice(1);
    }
  }
  
  // If no prefix, assume the whole name is the entity (capitalized)
  if (operationName.charAt(0).toUpperCase() === operationName.charAt(0)) {
    return operationName;
  }
  
  return undefined;
}

/**
 * Infer HTTP method from operation name
 */
export function inferMethodFromName(operationName: string): string {
  if (operationName.startsWith("list") || operationName.startsWith("get") || 
      operationName.startsWith("search") || operationName.startsWith("find")) {
    return "GET";
  }
  if (operationName.startsWith("create")) {
    return "POST";
  }
  if (operationName.startsWith("update")) {
    return "PUT";
  }
  if (operationName.startsWith("delete")) {
    return "DELETE";
  }
  // Default for custom operations
  return "POST";
}

/**
 * Infer operation type from name
 */
export function inferOperationType(operationName: string): ParsedOperation["operationType"] {
  if (operationName.startsWith("list")) {
    return "list";
  }
  if (operationName.startsWith("get")) {
    return "get";
  }
  if (operationName.startsWith("create")) {
    return "create";
  }
  if (operationName.startsWith("update")) {
    return "update";
  }
  if (operationName.startsWith("delete")) {
    return "delete";
  }
  if (operationName.startsWith("search") || operationName.startsWith("find")) {
    return "search";
  }
  return "custom";
}

/**
 * Infer path from operation name
 * Examples:
 * - listPosts -> /posts
 * - getPost -> /posts/{id}
 * - createPost -> /posts
 * - updatePost -> /posts/{id}
 * - deletePost -> /posts/{id}
 * - searchPosts -> /posts/search
 * - publishPost -> /posts/{id}/publish
 */
export function inferPathFromName(
  operationName: string,
  entityName?: string,
  parentEntity?: string
): string {
  const opType = inferOperationType(operationName);
  
  // If parent is specified, create nested path
  if (parentEntity) {
    const parentPath = entityNameToPath(parentEntity);
    const parentIdParam = `${parentEntity.charAt(0).toLowerCase() + parentEntity.slice(1)}Id`;
    
    // Extract child entity from operation name
    let childEntity = entityName;
    if (!childEntity) {
      // Try to extract from operation name (e.g., listPostComments -> Comment)
      const parts = operationName.split(/(?=[A-Z])/);
      // Find the part after parent entity
      const parentIndex = parts.findIndex(p => 
        p.toLowerCase() === parentEntity.toLowerCase()
      );
      if (parentIndex >= 0 && parentIndex < parts.length - 1) {
        childEntity = parts.slice(parentIndex + 1).join("");
      }
    }
    
    if (childEntity) {
      const childPath = entityNameToPath(childEntity);
      
      if (opType === "list") {
        return `/${parentPath}/{${parentIdParam}}/${childPath}`;
      }
      if (opType === "get") {
        return `/${parentPath}/{${parentIdParam}}/${childPath}/{id}`;
      }
      if (opType === "create") {
        return `/${parentPath}/{${parentIdParam}}/${childPath}`;
      }
      if (opType === "delete") {
        return `/${parentPath}/{${parentIdParam}}/${childPath}/{id}`;
      }
    }
  }
  
  // Standard paths without parent
  if (!entityName) {
    entityName = extractEntityName(operationName);
  }
  
  if (!entityName) {
    // Fallback: use operation name as-is (lowercase, kebab-case)
    const kebab = operationName
      .replace(/([A-Z])/g, "-$1")
      .toLowerCase()
      .replace(/^-/, "");
    return `/${kebab}`;
  }
  
  const pathSegment = entityNameToPath(entityName);
  
  if (opType === "list") {
    return `/${pathSegment}`;
  }
  if (opType === "get") {
    return `/${pathSegment}/{id}`;
  }
  if (opType === "create") {
    return `/${pathSegment}`;
  }
  if (opType === "update") {
    return `/${pathSegment}/{id}`;
  }
  if (opType === "delete") {
    return `/${pathSegment}/{id}`;
  }
  if (opType === "search") {
    return `/${pathSegment}/search`;
  }
  
  // Custom operation (e.g., publishPost -> /posts/{id}/publish)
  // Extract verb from name (everything after entity name)
  const entityLower = entityName.toLowerCase();
  const nameLower = operationName.toLowerCase();
  if (nameLower.includes(entityLower)) {
    const verb = nameLower.replace(entityLower, "").replace(/^list|^get|^create|^update|^delete/, "");
    if (verb) {
      return `/${pathSegment}/{id}/${verb}`;
    }
  }
  
  // Fallback
  return `/${pathSegment}`;
}
