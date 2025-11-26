/**
 * SDK Generator for Yama
 * Generates TypeScript SDK client from yama.yaml endpoint definitions
 */

export interface EndpointDefinition {
  path: string;
  method: string;
  handler?: string; // Optional - endpoints can work without handlers
  description?: string;
  query?: Record<string, {
    type?: string;
    required?: boolean;
    min?: number;
    max?: number;
  }>;
  params?: Record<string, {
    type?: string;
    required?: boolean;
  }>;
  body?: {
    type?: string;
  };
  response?: {
    type?: string;
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
  endpoints?: EndpointDefinition[];
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
function generateQueryType(query?: Record<string, unknown>): string {
  if (!query || Object.keys(query).length === 0) {
    return "Record<string, never>";
  }

  const props: string[] = [];
  for (const [key, def] of Object.entries(query)) {
    const defObj = def as { type?: string; required?: boolean };
    const optional = defObj.required ? "" : "?";
    const type = defObj.type === "integer" ? "number" : (defObj.type || "unknown");
    props.push(`  ${key}${optional}: ${type};`);
  }

  return `{\n${props.join("\n")}\n}`;
}

/**
 * Generate TypeScript type for path parameters
 */
function generateParamsType(params?: Record<string, unknown>): string {
  if (!params || Object.keys(params).length === 0) {
    return "Record<string, never>";
  }

  const props: string[] = [];
  for (const [key, def] of Object.entries(params)) {
    const defObj = def as { type?: string; required?: boolean };
    const type = defObj.type === "integer" ? "number" : (defObj.type || "string");
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
  const hasQuery = endpoint.query && Object.keys(endpoint.query).length > 0;
  const hasBody = endpoint.body !== undefined;
  // For DELETE without response, use void; otherwise use the response type or unknown
  let responseType = endpoint.response?.type || (endpoint.method === "DELETE" ? "void" : "unknown");
  
  // Detect if this endpoint uses pagination and should return PaginatedResponse
  const hasPagination = endpoint.query && (
    endpoint.query.page !== undefined ||
    endpoint.query.pageSize !== undefined ||
    endpoint.query.cursor !== undefined ||
    endpoint.query.limit !== undefined ||
    endpoint.query.offset !== undefined
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
    const bodyType = endpoint.body?.type || "unknown";
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
    queryCode = `\n    const queryParams = new URLSearchParams();\n`;
    queryCode += `    if (query) {\n`;
    for (const [key, def] of Object.entries(endpoint.query || {})) {
      const defObj = def as { required?: boolean };
      if (defObj.required) {
        queryCode += `      queryParams.append("${key}", String(query.${key}));\n`;
      } else {
        queryCode += `      if (query.${key} !== undefined) {\n`;
        queryCode += `        queryParams.append("${key}", String(query.${key}));\n`;
        queryCode += `      }\n`;
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
  const endpoints = config.endpoints || [];

  // Collect all type names used
  const typeNames = new Set<string>();
  let needsPaginatedResponse = false;
  
  for (const endpoint of endpoints) {
    if (endpoint.body?.type) {
      typeNames.add(endpoint.body.type);
    }
    if (endpoint.response?.type) {
      // Check if this endpoint uses pagination
      const hasPagination = endpoint.query && (
        endpoint.query.page !== undefined ||
        endpoint.query.pageSize !== undefined ||
        endpoint.query.cursor !== undefined ||
        endpoint.query.limit !== undefined ||
        endpoint.query.offset !== undefined
      );
      
      if (hasPagination && endpoint.response.type !== "void") {
        // Extract item type for paginated responses
        const responseType = endpoint.response.type;
        if (responseType.endsWith("Array") || responseType.toLowerCase().includes("list")) {
          const itemType = responseType.replace(/Array$/i, "").replace(/List$/i, "");
          typeNames.add(itemType);
          needsPaginatedResponse = true;
        } else {
          typeNames.add(responseType);
          needsPaginatedResponse = true;
        }
      } else {
        typeNames.add(endpoint.response.type);
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

