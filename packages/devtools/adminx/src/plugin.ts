import type { YamaPlugin } from "@yamajs/kernel";
import { resolveAdminXConfig } from "./config";
import { registerAdminXRoutes } from "./routes";
import type { AdminXPluginAPI, AdminXPluginConfig } from "./types";

const plugin: YamaPlugin = {
  name: "@yamajs/adminx",
  category: "devtools",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts: Record<string, unknown>) {
    const nodeEnv = process.env.NODE_ENV || "development";
    const resolved = resolveAdminXConfig(opts as AdminXPluginConfig, nodeEnv);

    const api: AdminXPluginAPI = {
      getConfig() {
        return resolved;
      },
      registerRoutes(args) {
        registerAdminXRoutes(resolved, args);
      },
    };

    return api;
  },
};

export default plugin;

