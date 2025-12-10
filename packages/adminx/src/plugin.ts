import type { YamaPlugin } from "@betagors/yama-core";
import { resolveAdminXConfig } from "./config.js";
import { registerAdminXRoutes } from "./routes.js";
import type { AdminXPluginAPI, AdminXPluginConfig } from "./types.js";

const plugin: YamaPlugin = {
  name: "@betagors/yama-adminx",
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

