import type { YamaEntities, YamaSchemas } from "@betagors/yama-core";

export interface AdminXPluginConfig {
  enabled?: boolean;
  path?: string;
  requireAuth?: boolean;
  allowInProduction?: boolean;
  devPassword?: string;
}

export interface AdminXResolvedConfig {
  enabled: boolean;
  path: string;
  requireAuth: boolean;
  allowInProduction: boolean;
  devPassword?: string;
  nodeEnv: string;
}

export interface AdminXRouteArgs {
  serverAdapter: {
    registerRoute: (
      server: unknown,
      method: string,
      path: string,
      handler: (request: any, reply: any) => Promise<unknown> | unknown
    ) => void;
  };
  server: unknown;
  config: Record<string, unknown>;
  configDir?: string;
  projectDir: string;
  entities?: YamaEntities;
  schemas?: YamaSchemas;
  repositories?: Record<string, any>;
  nodeEnv: string;
}

export interface AdminXPluginAPI {
  getConfig(): AdminXResolvedConfig;
  registerRoutes(args: AdminXRouteArgs): void;
}

