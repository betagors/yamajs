import {
  S3Client,
  S3ClientConfig,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  type GetObjectCommandOutput,
  type PutObjectCommandOutput,
  type HeadObjectCommandOutput,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand as GetObjectCommandType } from "@aws-sdk/client-s3";

export interface S3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string; // For S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
  forcePathStyle?: boolean; // For S3-compatible services
  [key: string]: unknown;
}

let s3Client: S3Client | null = null;

/**
 * Initialize S3 client
 */
export function initS3Client(config: S3Config): S3Client {
  if (s3Client) {
    return s3Client;
  }

  const clientConfig: S3ClientConfig = {
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  };

  // Support S3-compatible endpoints
  if (config.endpoint) {
    clientConfig.endpoint = config.endpoint;
    clientConfig.forcePathStyle = config.forcePathStyle ?? true;
  }

  s3Client = new S3Client(clientConfig);
  return s3Client;
}

/**
 * Get S3 client (must be initialized first)
 */
export function getS3Client(): S3Client {
  if (!s3Client) {
    throw new Error("S3 client not initialized. Call initS3Client() first.");
  }
  return s3Client;
}

/**
 * Close S3 client
 */
export function closeS3Client(): void {
  s3Client = null;
}

