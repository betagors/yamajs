import type {
  StorageAdapter,
  StorageBucket,
  UploadOptions,
  UploadResult,
  StorageMetadata,
} from "@betagors/yama-core";
import { promises as fs } from "fs";
import { join, dirname } from "path";
import { Readable } from "stream";

export interface FSAdapterConfig {
  basePath: string;
  baseUrl?: string; // Optional base URL for generating file URLs
}

/**
 * Create filesystem storage adapter
 */
export function createFSAdapter(config: FSAdapterConfig): StorageAdapter {
  const { basePath, baseUrl } = config;

  // Ensure base directory exists
  const ensureBaseDir = async () => {
    try {
      await fs.mkdir(basePath, { recursive: true });
    } catch (error) {
      // Ignore if directory already exists
    }
  };

  const getFilePath = (key: string): string => {
    // Normalize path to prevent directory traversal
    const normalizedKey = key.replace(/\.\./g, "").replace(/^\//, "");
    return join(basePath, normalizedKey);
  };

  const adapter: StorageAdapter = {
    async upload(
      key: string,
      data: Buffer | ReadableStream<Uint8Array>,
      options?: UploadOptions
    ): Promise<UploadResult> {
      await ensureBaseDir();

      // Convert ReadableStream to Buffer if needed
      let buffer: Buffer;
      if (data instanceof Buffer) {
        buffer = data;
      } else if (data instanceof ReadableStream) {
        const chunks: Uint8Array[] = [];
        const reader = data.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        buffer = Buffer.concat(chunks);
      } else {
        throw new Error("Invalid data type: expected Buffer or ReadableStream");
      }

      const filePath = getFilePath(key);
      const dir = dirname(filePath);

      // Ensure directory exists
      await fs.mkdir(dir, { recursive: true });

      // Write file
      await fs.writeFile(filePath, buffer);

      // Set metadata if supported by filesystem
      // Note: Filesystem doesn't support all metadata, but we can store it separately if needed

      return {
        key,
        size: buffer.length,
      };
    },

    async download(key: string): Promise<Buffer | ReadableStream<Uint8Array>> {
      const filePath = getFilePath(key);
      return fs.readFile(filePath);
    },

    async delete(key: string): Promise<void> {
      const filePath = getFilePath(key);
      try {
        await fs.unlink(filePath);
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          // File doesn't exist, that's okay
          return;
        }
        throw error;
      }
    },

    async exists(key: string): Promise<boolean> {
      const filePath = getFilePath(key);
      try {
        await fs.access(filePath);
        return true;
      } catch {
        return false;
      }
    },

    async getUrl(key: string, expiresIn?: number): Promise<string> {
      if (baseUrl) {
        // Use configured base URL
        const normalizedKey = key.replace(/^\//, "");
        return `${baseUrl}/${normalizedKey}`;
      }

      // Return file:// URL
      const filePath = getFilePath(key);
      return `file://${filePath}`;
    },

    async list(prefix?: string): Promise<string[]> {
      const searchPath = prefix ? join(basePath, prefix.replace(/\.\./g, "")) : basePath;

      const keys: string[] = [];

      const listRecursive = async (dir: string, relativePath: string = ""): Promise<void> => {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            const relativeKey = relativePath ? `${relativePath}/${entry.name}` : entry.name;

            if (entry.isDirectory()) {
              await listRecursive(fullPath, relativeKey);
            } else {
              keys.push(relativeKey);
            }
          }
        } catch (error: unknown) {
          // Directory doesn't exist or can't be read
          if (error && typeof error === "object" && "code" in error && error.code !== "ENOENT") {
            throw error;
          }
        }
      };

      await listRecursive(searchPath, prefix?.replace(/\.\./g, "") || "");

      return keys;
    },

    async getMetadata(key: string): Promise<StorageMetadata | null> {
      const filePath = getFilePath(key);

      try {
        const stats = await fs.stat(filePath);

        return {
          key,
          size: stats.size,
          lastModified: stats.mtime,
        };
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
          return null;
        }
        throw error;
      }
    },

    async copy(sourceKey: string, destKey: string): Promise<void> {
      const sourcePath = getFilePath(sourceKey);
      const destPath = getFilePath(destKey);
      const destDir = dirname(destPath);

      // Ensure destination directory exists
      await fs.mkdir(destDir, { recursive: true });

      // Copy file
      await fs.copyFile(sourcePath, destPath);
    },
  };

  return adapter;
}

/**
 * Create filesystem storage bucket (wrapper for consistency with S3)
 */
export function createFSBucket(config: FSAdapterConfig): StorageBucket {
  const adapter = createFSAdapter(config);
  return {
    async upload(key: string, data: Buffer | ReadableStream<Uint8Array>, options?: UploadOptions): Promise<UploadResult> {
      return adapter.upload(key, data, options);
    },
    async download(key: string): Promise<Buffer | ReadableStream<Uint8Array>> {
      return adapter.download(key);
    },
    async delete(key: string): Promise<void> {
      return adapter.delete(key);
    },
    async exists(key: string): Promise<boolean> {
      return adapter.exists(key);
    },
    async getUrl(key: string, expiresIn?: number): Promise<string> {
      return adapter.getUrl(key, expiresIn);
    },
    async list(prefix?: string): Promise<string[]> {
      return adapter.list(prefix);
    },
    async getMetadata(key: string): Promise<StorageMetadata | null> {
      return adapter.getMetadata(key);
    },
    async copy(sourceKey: string, destKey: string): Promise<void> {
      return adapter.copy(sourceKey, destKey);
    },
  };
}

