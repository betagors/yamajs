import type { Transport } from "../logger.js";
import type { LogEvent } from "../event.js";
import { formatLogEntry, type LogFormat } from "../formatters.js";

export interface S3TransportConfig {
  bucket: string;
  prefix?: string;
  format?: LogFormat;
  batchSize?: number;
  flushInterval?: number;
}

/**
 * Minimal interface required for S3 uploading.
 * This avoids a hard dependency on @yamajs/kernel or any specific S3 package.
 */
export interface S3Uploader {
  upload(key: string, data: Buffer | Uint8Array): Promise<void>;
}

/**
 * S3 Transport Adapter.
 * Handles batched uploads to S3 compatible storage.
 */
export class S3Transport implements Transport {
  private config: S3TransportConfig;
  private uploader: S3Uploader | null;
  private batch: string[] = [];
  private format: LogFormat;
  private flushTimer?: any;

  constructor(config: S3TransportConfig, uploader?: S3Uploader) {
    this.config = config;
    this.uploader = uploader ?? null;
    this.format = config.format || "json";

    if (config.flushInterval) {
      this.flushTimer = setInterval(() => this.flush(), config.flushInterval);
    }
  }

  async write(event: LogEvent): Promise<void> {
    const formatted = formatLogEntry(event, this.format);
    this.batch.push(formatted);

    if (this.batch.length >= (this.config.batchSize || 100)) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.uploader || this.batch.length === 0) return;

    const data = Buffer.from(this.batch.join("\n") + "\n", "utf8");
    const timestamp = Date.now();
    const key = `${this.config.prefix || ""}logs/${new Date().toISOString().split('T')[0]}/${timestamp}.log`;

    const currentBatch = [...this.batch];
    this.batch = [];

    try {
      await this.uploader.upload(key, data);
    } catch (err: any) {
      console.error(`[Logging] S3 Transport failure: ${err.message}`);
      // Fallback: put back in batch if possible or just drop?
      // Core logging usually drops to avoid memory leaks if destination is dead.
    }
  }

  async close(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }
}

export function createS3Transport(config: S3TransportConfig, uploader?: S3Uploader): S3Transport {
  return new S3Transport(config, uploader);
}
