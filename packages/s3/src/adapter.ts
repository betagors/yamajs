import type {
  StorageAdapter,
  StorageBucket,
  UploadOptions,
  UploadResult,
  StorageMetadata,
} from "@betagors/yama-core";
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  GetObjectCommandInput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "stream";
import { getS3Client, initS3Client, type S3Config } from "./client";

export interface S3AdapterConfig extends S3Config {
  bucket: string;
  public?: boolean; // Whether bucket is public (affects URL generation)
}


/**
 * Create S3 storage adapter
 */
export function createS3Adapter(config: S3AdapterConfig): StorageAdapter {
  const client = initS3Client(config);
  const bucket = config.bucket;
  const isPublic = config.public ?? false;

  const adapter: StorageAdapter = {
    async upload(
      key: string,
      data: Buffer | ReadableStream<Uint8Array>,
      options?: UploadOptions
    ): Promise<UploadResult> {
      // Convert ReadableStream to Buffer if needed
      let body: Buffer | Readable;
      if (data instanceof Buffer) {
        body = data;
      } else if (data instanceof ReadableStream) {
        // Convert ReadableStream to Readable stream
        const chunks: Uint8Array[] = [];
        const reader = data.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        body = Buffer.concat(chunks);
      } else {
        throw new Error("Invalid data type: expected Buffer or ReadableStream");
      }

      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: options?.contentType,
        ContentEncoding: options?.contentEncoding,
        Metadata: options?.metadata,
        CacheControl: options?.cacheControl,
        Expires: options?.expires,
        ACL: (options?.acl as any) || (isPublic ? "public-read" : "private"),
      });

      const response = await client.send(command);

      return {
        key,
        size: body.length,
        etag: response.ETag,
        versionId: response.VersionId,
      };
    },

    async download(key: string): Promise<Buffer | ReadableStream<Uint8Array>> {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await client.send(command);

      if (!response.Body) {
        throw new Error(`Object ${key} not found or empty`);
      }

      // Convert stream to Buffer for consistency
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", () => resolve(Buffer.concat(chunks)));
        stream.on("error", reject);
      });
    },

    async delete(key: string): Promise<void> {
      const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      await client.send(command);
    },

    async exists(key: string): Promise<boolean> {
      try {
        const command = new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        await client.send(command);
        return true;
      } catch (error: unknown) {
        if (error && typeof error === "object" && "name" in error && error.name === "NotFound") {
          return false;
        }
        throw error;
      }
    },

    async getUrl(key: string, expiresIn?: number): Promise<string> {
      if (isPublic && !expiresIn) {
        // Public bucket - return direct URL
        const endpoint = config.endpoint || `https://s3.${config.region}.amazonaws.com`;
        return `${endpoint}/${bucket}/${key}`;
      }

      // Generate signed URL
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const expiresInSeconds = expiresIn || 3600; // Default 1 hour
      return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
    },

    async list(prefix?: string): Promise<string[]> {
      const keys: string[] = [];
      let continuationToken: string | undefined;

      do {
        const command = new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        });

        const response = await client.send(command);

        if (response.Contents) {
          for (const object of response.Contents) {
            if (object.Key) {
              keys.push(object.Key);
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      return keys;
    },

    async getMetadata(key: string): Promise<StorageMetadata | null> {
      try {
        const command = new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        });

        const response = await client.send(command);

        return {
          key,
          size: response.ContentLength || 0,
          contentType: response.ContentType,
          contentEncoding: response.ContentEncoding,
          lastModified: response.LastModified,
          etag: response.ETag,
          metadata: response.Metadata,
        };
      } catch (error: unknown) {
        if (error && typeof error === "object" && "name" in error && error.name === "NotFound") {
          return null;
        }
        throw error;
      }
    },

    async copy(sourceKey: string, destKey: string): Promise<void> {
      const command = new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${sourceKey}`,
        Key: destKey,
      });

      await client.send(command);
    },
  };

  return adapter;
}

/**
 * Create S3 storage bucket
 */
export function createS3Bucket(config: S3AdapterConfig): StorageBucket {
  const adapter = createS3Adapter(config);
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

