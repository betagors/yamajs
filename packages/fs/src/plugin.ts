import type { YamaPlugin } from "@betagors/yama-core";
import { registerStorageAdapter } from "@betagors/yama-core";
import { createFSBucket, type FSAdapterConfig } from "./adapter";

/**
 * Filesystem storage plugin
 */
const plugin: YamaPlugin = {
  name: "@betagors/yama-fs",
  category: "storage",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts?: Record<string, unknown>) {
    const config = opts as {
      basePath: string;
      baseUrl?: string;
    };

    if (!config.basePath) {
      throw new Error("FS plugin requires basePath");
    }

    // Register storage adapter factory
    registerStorageAdapter("fs", (storageConfig) => {
      const fsConfig = storageConfig as unknown as FSAdapterConfig;
      if (!fsConfig.basePath) {
        throw new Error("FS adapter requires basePath in config");
      }
      return createFSBucket(fsConfig);
    });

    // Create single bucket (simplified - no multiple buckets for FS)
    const bucket = createFSBucket({
      basePath: config.basePath,
      baseUrl: config.baseUrl,
    });

    // Return plugin API
    return {
      bucket,
      // For consistency with S3 plugin, also expose as "default"
      buckets: {
        default: bucket,
      },
    };
  },
};

export default plugin;

