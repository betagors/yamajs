import type { YamaPlugin } from "@yamajs/core";
import { registerStorageAdapter } from "@yamajs/core";
import { createS3Bucket, type S3AdapterConfig } from "./adapter";
import { initS3Client, getS3Client, closeS3Client } from "./client";

/**
 * S3 storage plugin
 */
const plugin: YamaPlugin = {
  name: "@yamajs/s3",
  category: "storage",
  pluginApi: "1.0",
  yamaCore: "^0.1.0",

  async init(opts?: Record<string, unknown>) {
    const config = opts as {
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      endpoint?: string;
      forcePathStyle?: boolean;
      buckets?: Record<string, { name: string; public?: boolean }>;
    };

    if (!config.region || !config.accessKeyId || !config.secretAccessKey) {
      throw new Error("S3 plugin requires region, accessKeyId, and secretAccessKey");
    }

    // Initialize S3 client
    initS3Client({
      region: config.region,
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
    });

    // Register storage adapter factory
    registerStorageAdapter("s3", (storageConfig) => {
      const s3Config = storageConfig as S3AdapterConfig;
      return createS3Bucket(s3Config);
    });

    // Create buckets from configuration
    const buckets: Record<string, ReturnType<typeof createS3Bucket>> = {};

    if (config.buckets) {
      for (const [bucketAlias, bucketConfig] of Object.entries(config.buckets)) {
        buckets[bucketAlias] = createS3Bucket({
          region: config.region,
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
          endpoint: config.endpoint,
          forcePathStyle: config.forcePathStyle,
          bucket: bucketConfig.name,
          public: bucketConfig.public ?? false,
        });
      }
    }

    // Return plugin API
    return {
      buckets,
      client: {
        init: initS3Client,
        get: getS3Client,
        close: closeS3Client,
      },
    };
  },

  async onStop() {
    closeS3Client();
  },
};

export default plugin;

