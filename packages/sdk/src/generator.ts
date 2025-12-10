/**
 * Legacy SDK generator removed.
 * Use Yama IR and the runtime client (YamaClient).
 */
export function generateSDK(): string {
  throw new Error("generateSDK has been removed. Use Yama IR and YamaClient.");
}
/**
 * SDK Generator for Yama
 * Generates TypeScript SDK client from yama.yaml endpoint definitions
 */

import type { SchemaField } from "@betagors/yama-core";
import { normalizeQueryOrParams, normalizeApisConfig } from "@betagors/yama-core";

export interface EndpointDefinition {
  path: string;
  method: string;
  handler?: string; // Optional - endpoints can work without handlers
  description?: string;
  query?: Record<string, SchemaField> | { type?: string; properties?: Record<string, SchemaField>; required?: string[] };
  params?: Record<string, SchemaField> | { type?: string; properties?: Record<string, SchemaField>; required?: string[] };
  body?: string | {
    type?: string;
  };
  response?: string | {
    type?: string;
    properties?: Record<string, SchemaField>;
  };
  auth?: {
    required?: boolean;
    roles?: string[];
  };
}

export interface AuthProvider {
  type: "jwt" | "api-key";
  secret?: string;
  header?: string;
}

export interface YamaConfig {
  name?: string;
  version?: string;
  auth?: {
    providers?: AuthProvider[];
  };
  apis?: {
    rest?: any;
  };
}

export interface GenerateSDKOptions {
  baseUrl?: string;
  typesImportPath?: string;
  framework?: string;
}

/**
 * Convert endpoint path to method name
 * e.g., "/todos/:id" -> "getTodoById"
 */
function pathToMethodName(path: string, method: string, handler?: string): string {
  // Use handler name if available (e.g., "getTodoById" -> "getTodoById")
  if (handler) {
    // Convert camelCase handler to camelCase method name
    return handler;
  }

  // Otherwise, generate from path and method
  const parts = path
    .split("/")
    .filter(p => p && !p.startsWith(":"))
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  
  const methodPrefix = method.toLowerCase();
  const methodName = methodPrefix + parts.join("");
  
  // Convert to camelCase
  return methodName.charAt(0).toLowerCase() + methodName.slice(1);
}

/**
 * Extract path parameters from endpoint path
 */
function extractPathParams(path: string): string[] {
  const matches = path.matchAll(/:(\w+)/g);
  return Array.from(matches, m => m[1]);
}

/**
 * Generate TypeScript type for query parameters
 */
function generateQueryType(query?: Record<string, SchemaField> | { type?: string; properties?: Record<string, SchemaField>; required?: string[] }): string {
  // Normalize query from schema format to internal format
  const normalizedQuery = normalizeQueryOrParams(query);
  
  if (!normalizedQuery || Object.keys(normalizedQuery).length === 0) {
    return "Record<string, never>";
  }

  const props: string[] = [];
  for (const [key, field] of Object.entries(normalizedQuery)) {
    const optional = field.required ? "" : "?";
    let type: string;
    
    // Handle type conversion
    if (field.type === "integer" || field.type === "number") {
      type = "number";
    } else if (field.type === "boolean") {
      type = "boolean";
    } else if (field.type === "string") {
      type = "string";
    } else if (field.type === "array" || field.type === "list") {
      // For arrays, we'd need to handle items, but for query params, arrays are typically strings
      type = "string[]";
    } else {
      // Could be a schema reference or unknown
      type = field.type || "unknown";
    }
    
    props.push(`  ${key}${optional}: ${type};`);
  }

  return `{\n${props.join("\n")}\n}`;
}

/**
 * Generate TypeScript type for path parameters
 */
function generateParamsType(params?: Record<string, SchemaField> | { type?: string; properties?: Record<string, SchemaField>; required?: string[] }): string {
  // Normalize params from schema format to internal format
  const normalizedParams = normalizeQueryOrParams(params);
  
  if (!normalizedParams || Object.keys(normalizedParams).length === 0) {
    return "Record<string, never>";
  }

  const props: string[] = [];
  for (const [key, field] of Object.entries(normalizedParams)) {
    let type: string;
    
    // Handle type conversion
    if (field.type === "integer" || field.type === "number") {
      type = "number";
    } else if (field.type === "boolean") {
      type = "boolean";
    } else {
      // Path params are typically strings
      type = field.type || "string";
    }
    
    props.push(`  ${key}: ${type};`);
  }

  return `{\n${props.join("\n")}\n}`;
}

/**
 * Generate method signature and implementation for an endpoint
 */
function generateEndpointMethod(
  endpoint: EndpointDefinition,
  typesImportPath: string,
  hasJwt: boolean,
  hasApiKey: boolean,
  apiKeyHeader: string
): string {
  const methodName = pathToMethodName(endpoint.path, endpoint.method, endpoint.handler);
  const pathParams = extractPathParams(endpoint.path);
  const hasPathParams = pathParams.length > 0;
  // Normalize query to check if it has any fields
  const normalizedQuery = normalizeQueryOrParams(endpoint.query);
  const hasQuery = normalizedQuery && Object.keys(normalizedQuery).length > 0;
  const hasBody = endpoint.body !== undefined;
  // For DELETE without response, use void; otherwise use the response type or unknown
  let responseType: string;
  if (typeof endpoint.response === "string") {
    responseType = endpoint.response;
  } else if (endpoint.response?.type) {
    responseType = endpoint.response.type;
  } else {
    responseType = endpoint.method === "DELETE" ? "void" : "unknown";
  }
  
  // Detect if this endpoint uses pagination and should return PaginatedResponse
  const normalizedQueryForPagination = normalizeQueryOrParams(endpoint.query);
  const hasPagination = normalizedQueryForPagination && (
    normalizedQueryForPagination.page !== undefined ||
    normalizedQueryForPagination.pageSize !== undefined ||
    normalizedQueryForPagination.cursor !== undefined ||
    normalizedQueryForPagination.limit !== undefined ||
    normalizedQueryForPagination.offset !== undefined
  );
  
  // If pagination is detected and response is an array type, wrap with PaginatedResponse
  if (hasPagination && responseType !== "void" && responseType !== "unknown") {
    // Check if response type ends with Array (common pattern) or is a list
    if (responseType.endsWith("Array") || responseType.toLowerCase().includes("list")) {
      // Extract the item type from array type (e.g., "ProductArray" -> "Product")
      const itemType = responseType.replace(/Array$/i, "").replace(/List$/i, "");
      responseType = `PaginatedResponse<${itemType}>`;
    } else {
      // For other array types, wrap with PaginatedResponse
      responseType = `PaginatedResponse<${responseType}>`;
    }
  }

  // Build method parameters
  const params: string[] = [];
  
  if (hasPathParams) {
    const paramsType = generateParamsType(endpoint.params);
    params.push(`params: ${paramsType}`);
  }
  
  if (hasQuery) {
    const queryType = generateQueryType(endpoint.query);
    params.push(`query${hasPathParams ? "?" : ""}: ${queryType}`);
  }
  
  if (hasBody) {
    const bodyType = typeof endpoint.body === "string" 
      ? endpoint.body 
      : (endpoint.body?.type || "unknown");
    params.push(`body: ${bodyType}`);
  }

  // Build options parameter if needed
  const needsOptions = !hasPathParams && !hasQuery && !hasBody;
  if (needsOptions) {
    params.push("options?: RequestInit");
  } else {
    params.push("options?: Omit<RequestInit, 'method' | 'body'>");
  }

  // Format parameters with proper line breaks for readability
  let paramsStr = "";
  if (params.length > 0) {
    if (params.length === 1) {
      paramsStr = params[0];
    } else {
      paramsStr = params.join(",\n    ");
    }
  }

  // Build URL construction
  let urlCode = `    let url = \`\${this.baseUrl}${endpoint.path}\`;`;
  
  if (hasPathParams) {
    for (const param of pathParams) {
      urlCode += `\n    url = url.replace(/:${param}/g, String(params.${param}));`;
    }
  }

  // Build query string construction
  let queryCode = "";
  if (hasQuery) {
    // Normalize query to get the actual fields
    const normalizedQuery = normalizeQueryOrParams(endpoint.query);
    queryCode = `\n    const queryParams = new URLSearchParams();\n`;
    queryCode += `    if (query) {\n`;
    if (normalizedQuery) {
      for (const [key, field] of Object.entries(normalizedQuery)) {
        if (field.required) {
          queryCode += `      queryParams.append("${key}", String(query.${key}));\n`;
        } else {
          queryCode += `      if (query.${key} !== undefined) {\n`;
          queryCode += `        queryParams.append("${key}", String(query.${key}));\n`;
          queryCode += `      }\n`;
        }
      }
    }
    queryCode += `    }\n`;
    queryCode += `    const queryString = queryParams.toString();\n`;
    queryCode += `    if (queryString) {\n`;
    queryCode += `      url += \`?\${queryString}\`;\n`;
    queryCode += `    }\n`;
  }

  // Build body code
  let bodyCode = "";
  if (hasBody) {
    bodyCode = `\n    const bodyStr = JSON.stringify(body);`;
  }

  // Build fetch call
  const methodUpper = endpoint.method.toUpperCase();
  const fetchBody = hasBody ? "body: bodyStr," : "";
  
  // Build headers with auth
  const needsAuth = endpoint.auth?.required !== false;
  let headersCode = `      headers: {\n        "Content-Type": "application/json",`;
  if (needsAuth && hasJwt) {
    headersCode += `\n        ...(this.jwtToken ? { "Authorization": \`Bearer \${this.jwtToken}\` } : {}),`;
  }
  if (needsAuth && hasApiKey) {
    headersCode += `\n        ...(this.apiKey ? { "${apiKeyHeader}": this.apiKey } : {}),`;
  }
  headersCode += `\n        ...options?.headers,\n      },`;
  
  // Handle response based on type
  let returnCode = "";
  if (responseType === "void") {
    returnCode = `\n    const response = await fetch(url, {\n      method: "${methodUpper}",${fetchBody ? `\n      ${fetchBody}` : ""}\n${headersCode}\n      ...options,\n    });\n\n    if (!response.ok) {\n      throw new Error(\`HTTP error! status: \${response.status}\`);\n    }`;
  } else {
    returnCode = `\n    const response = await fetch(url, {\n      method: "${methodUpper}",${fetchBody ? `\n      ${fetchBody}` : ""}\n${headersCode}\n      ...options,\n    });\n\n    if (!response.ok) {\n      throw new Error(\`HTTP error! status: \${response.status}\`);\n    }\n\n    return await response.json() as ${responseType};`;
  }

  // Build JSDoc comment
  const jsdoc = endpoint.description 
    ? `  /**\n   * ${endpoint.description}\n   */\n`
    : "";

  // Format method signature with proper line breaks
  const methodSignature = params.length > 1
    ? `  async ${methodName}(\n    ${paramsStr}\n  ): Promise<${responseType}> {`
    : `  async ${methodName}(${paramsStr}): Promise<${responseType}> {`;

  return `${jsdoc}${methodSignature}${urlCode}${queryCode}${bodyCode}${returnCode}\n  }`;
}

/**
 * Generate SDK client code from Yama config
 */
export function generateSDK(
  config: YamaConfig,
  options: GenerateSDKOptions = {}
): string {
  const baseUrl = options.baseUrl || "http://localhost:3000";
  const typesImportPath = options.typesImportPath || "./types";
  
  // Normalize APIs config and extract all endpoints
  const normalizedApis = normalizeApisConfig({ apis: config.apis });
  const endpoints = normalizedApis.rest.flatMap(restConfig => restConfig.endpoints);

  // Collect all type names used
  const typeNames = new Set<string>();
  let needsPaginatedResponse = false;
  
  for (const endpoint of endpoints) {
    // Handle body type
    if (endpoint.body) {
      const bodyType = typeof endpoint.body === "string" 
        ? endpoint.body 
        : endpoint.body?.type;
      if (bodyType) {
        typeNames.add(bodyType);
      }
    }
    
    // Handle response type
    let responseType: string | undefined;
    if (typeof endpoint.response === "string") {
      responseType = endpoint.response;
    } else if (endpoint.response?.type) {
      responseType = endpoint.response.type;
    }
    
    if (responseType) {
      // Check if this endpoint uses pagination
      const normalizedQueryForPagination = normalizeQueryOrParams(endpoint.query);
      const hasPagination = normalizedQueryForPagination && (
        normalizedQueryForPagination.page !== undefined ||
        normalizedQueryForPagination.pageSize !== undefined ||
        normalizedQueryForPagination.cursor !== undefined ||
        normalizedQueryForPagination.limit !== undefined ||
        normalizedQueryForPagination.offset !== undefined
      );
      
      if (hasPagination && responseType !== "void") {
        // Extract item type for paginated responses
        if (responseType.endsWith("Array") || responseType.toLowerCase().includes("list")) {
          const itemType = responseType.replace(/Array$/i, "").replace(/List$/i, "");
          typeNames.add(itemType);
          needsPaginatedResponse = true;
        } else {
          typeNames.add(responseType);
          needsPaginatedResponse = true;
        }
      } else {
        typeNames.add(responseType);
      }
    }
  }
  
  // Add PaginatedResponse to imports if needed
  if (needsPaginatedResponse) {
    typeNames.add("PaginatedResponse");
  }

  // Generate imports (only if types are needed)
  let imports = `// This file is auto-generated from yama.yaml
// Do not edit manually - your changes will be overwritten

`;
  
  if (typeNames.size > 0) {
    imports += `import type { ${Array.from(typeNames).join(", ")} } from "${typesImportPath}";\n`;
  }
  
  if (needsPaginatedResponse) {
    imports += `import type { PaginatedResponse } from "@betagors/yama-core";\n`;
  }
  
  imports += "\n";

  // Check if auth is configured
  const hasAuth = config.auth?.providers && config.auth.providers.length > 0;
  const hasJwt = Boolean(hasAuth && config.auth?.providers?.some(p => p.type === "jwt"));
  const hasApiKey = Boolean(hasAuth && config.auth?.providers?.some(p => p.type === "api-key"));
  const apiKeyHeader = hasApiKey ? config.auth?.providers?.find(p => p.type === "api-key")?.header || "X-API-Key" : "X-API-Key";

  // Generate client class
  const clientClass = `export class YamaClient {
  private baseUrl: string;
${hasJwt ? `  private jwtToken: string | null = null;` : ""}
${hasApiKey ? `  private apiKey: string | null = null;` : ""}

  constructor(baseUrl: string = "${baseUrl}") {
    this.baseUrl = baseUrl.replace(/\\/$/, "");
  }

  /**
   * Set the base URL for API requests
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\\/$/, "");
  }
${hasJwt ? `
  /**
   * Set JWT token for authentication
   */
  setToken(token: string): void {
    this.jwtToken = token;
  }

  /**
   * Clear JWT token
   */
  clearToken(): void {
    this.jwtToken = null;
  }` : ""}
${hasApiKey ? `
  /**
   * Set API key for authentication
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Clear API key
   */
  clearApiKey(): void {
    this.apiKey = null;
  }` : ""}

${endpoints.map(endpoint => generateEndpointMethod(endpoint, typesImportPath, hasJwt, hasApiKey, apiKeyHeader)).join("\n\n")}
}

/**
 * Create a new Yama client instance
 */
export function createClient(baseUrl?: string): YamaClient {
  return new YamaClient(baseUrl);
}

/**
 * Default client instance
 */
export const api = new YamaClient();
`;

  return imports + clientClass;
}

