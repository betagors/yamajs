import type { YamaIR } from "@betagors/yama-core";

export interface YamaClientOptions {
  /** IR object (preferred for build-time or local use) */
  ir?: YamaIR;
  /** URL to fetch IR from (e.g., https://api.example.com/yama/ir) */
  irUrl?: string;
  /** Override base URL for requests */
  baseUrl?: string;
  /** Auth token (Bearer) automatically added to requests */
  authToken?: string;
  /** Additional headers for every request */
  headers?: Record<string, string>;
  /** Custom fetch implementation (defaults to global fetch) */
  fetchFn?: typeof fetch;
}

export interface RequestOptions {
  method: string;
  path: string;
  params?: Record<string, string | number | boolean>;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  headers?: Record<string, string>;
}

export class YamaClient {
  private ir: YamaIR;
  private baseUrl?: string;
  private authToken?: string;
  private headers: Record<string, string>;
  private fetchFn: typeof fetch;

  private constructor(ir: YamaIR, options: YamaClientOptions) {
    this.ir = ir;
    this.baseUrl = options.baseUrl || ir.baseUrl;
    this.authToken = options.authToken;
    this.headers = options.headers || {};
    this.fetchFn = options.fetchFn || (globalThis as any).fetch;
    if (!this.fetchFn) {
      throw new Error("No fetch implementation found. Provide fetchFn in options.");
    }
  }

  static async create(options: YamaClientOptions): Promise<YamaClient> {
    const ir = await loadIr(options);
    return new YamaClient(ir, options);
  }

  /**
   * Perform a request using IR metadata.
   * Path params replace :param placeholders. Query object serialized.
   */
  async request<T = unknown>(options: RequestOptions): Promise<T> {
    const url = this.buildUrl(options.path, options.params, options.query);
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.headers,
      ...(options.headers || {}),
    };
    if (this.authToken && !headers.Authorization) {
      headers.Authorization = `Bearer ${this.authToken}`;
    }

    const res = await this.fetchFn(url, {
      method: options.method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");

    if (!res.ok) {
      const errorBody = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined);
      const err: any = new Error(`Request failed with status ${res.status}`);
      err.status = res.status;
      err.body = errorBody;
      throw err;
    }

    if (isJson) {
      return (await res.json()) as T;
    }
    // @ts-expect-error fallback to text
    return (await res.text()) as T;
  }

  /**
   * Convenience: find an endpoint from IR and call it.
   */
  async call<T = unknown>(id: { method: string; path: string }, options?: { params?: Record<string, any>; query?: Record<string, any>; body?: any; headers?: Record<string, string> }) {
    return this.request<T>({
      method: id.method,
      path: id.path,
      params: options?.params,
      query: options?.query,
      body: options?.body,
      headers: options?.headers,
    });
  }

  getEndpoints(): YamaIR["endpoints"] {
    return this.ir.endpoints;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean>, query?: Record<string, string | number | boolean | undefined>) {
    const base = this.baseUrl ? this.baseUrl.replace(/\/+$/, "") : "";
    const withParams = applyPathParams(path, params);
    const qs = query ? buildQuery(query) : "";
    return `${base}${withParams}${qs}`;
  }
}

async function loadIr(options: YamaClientOptions): Promise<YamaIR> {
  if (options.ir) return options.ir;
  if (!options.irUrl) {
    throw new Error("YamaClient requires either ir or irUrl");
  }
  const fetchFn = options.fetchFn || (globalThis as any).fetch;
  if (!fetchFn) {
    throw new Error("No fetch implementation found. Provide fetchFn in options.");
  }
  const res = await fetchFn(options.irUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch IR from ${options.irUrl}: ${res.status}`);
  }
  return (await res.json()) as YamaIR;
}

function applyPathParams(path: string, params?: Record<string, string | number | boolean>): string {
  if (!params) return path;
  return path.replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
    const value = params[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter: ${key}`);
    }
    return encodeURIComponent(String(value));
  });
}

function buildQuery(query: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(query).filter(([, v]) => v !== undefined);
  if (!entries.length) return "";
  const searchParams = new URLSearchParams();
  for (const [key, value] of entries) {
    searchParams.set(key, String(value));
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : "";
}

