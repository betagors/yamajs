import type { YamaSchemas } from "../schemas.js";
import type { NormalizedApisConfig, NormalizedEndpoint } from "../apis/types.js";
import type { AuthProvider } from "../auth/types.js";

/**
 * Versioned, minimal IR used to generate SDKs across languages.
 * Keep this lean and stable; include no secrets.
 */
export interface YamaIR {
  /** IR schema version */
  irVersion: string;
  /** Project name */
  name?: string;
  /** Project version */
  version?: string;
  /** Base URL hint for generated clients */
  baseUrl?: string;
  /** Auth providers (public metadata only) */
  auth?: {
    providers?: AuthProvider[];
  };
  /** Schemas/entities (public shapes only) */
  schemas: YamaSchemas | Record<string, unknown>;
  /** HTTP endpoints */
  endpoints: IRHttpEndpoint[];
  /** Additional API configs (optional, future use) */
  apis?: NormalizedApisConfig;
}

export interface IRHttpEndpoint {
  method: string;
  path: string;
  description?: string;
  query?: NormalizedEndpoint["query"];
  params?: NormalizedEndpoint["params"];
  body?: NormalizedEndpoint["body"];
  response?: NormalizedEndpoint["response"];
  auth?: NormalizedEndpoint["auth"];
  rateLimit?: NormalizedEndpoint["rateLimit"];
  apiName?: string;
  basePath?: string;
}

