import type { LogEntry, Transport, S3TransportConfig, LogFormat } from "../types.js";
import type { StorageBucket } from "@betagors/yama-core";
import { formatLogEntry } from "../formatters.js";

/**
 * S3 transport implementation
 */
export class S3Transport implements Transport {
  private config: S3TransportConfig;
  private bucket: StorageBucket | null = null;
  private batch: string[] = [];
  private batchSize: number;
  private format: LogFormat;
  private flushTimer: NodeJS.Timeout | null = null;
  private currentDate: string = "";

  constructor(config: S3TransportConfig, bucket: StorageBucket | null = null) {
    this.config = config;
    this.bucket = bucket;
    this.format = config.format || "json";
    this.batchSize = config.batchSize || 100;
    this.currentDate = this.getDatePrefix();

    // Auto-flush based on interval if configured
    if (config.flushInterval && config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch((err) => {
          console.error("Error flushing S3 transport:", err);
        });
      }, config.flushInterval);
    }
  }

  /**
   * Get date-based prefix for log files
   */
  private getDatePrefix(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  }

  /**
   * Get S3 key for log file
   */
  private getLogKey(): string {
    const prefix = this.config.prefix || "";
    const datePrefix = this.getDatePrefix();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${prefix}${datePrefix}/app-${timestamp}-${random}.log`;
  }

  async write(entry: LogEntry): Promise<void> {
    if (!this.bucket) {
      // Silently fail if bucket not available
      return;
    }

    const formatted = formatLogEntry(entry, this.format);
    this.batch.push(formatted);

    // Check if date changed (new day)
    const newDate = this.getDatePrefix();
    if (newDate !== this.currentDate) {
      await this.flush();
      this.currentDate = newDate;
    }

    // Flush if batch is full
    if (this.batch.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.bucket || this.batch.length === 0) {
      return;
    }

    try {
      const content = this.batch.join("\n") + "\n";
      const buffer = Buffer.from(content, "utf8");
      // Create unique key for each batch (include timestamp)
      const key = this.getLogKey();

      // Upload as new file (S3 doesn't support appending efficiently)
      await this.bucket.upload(key, buffer);

      this.batch = [];
    } catch (error) {
      console.error("Error writing to S3 transport:", error);
      // Don't throw - fail gracefully
    }
  }

  async close(): Promise<void> {
    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining batch
    await this.flush();
  }
}

/**
 * Create an S3 transport
 */
export function createS3Transport(
  config: S3TransportConfig,
  bucket: StorageBucket | null = null
): S3Transport {
  return new S3Transport(config, bucket);
}

