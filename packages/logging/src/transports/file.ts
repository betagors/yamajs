import type { LogEntry, Transport, FileTransportConfig, LogFormat } from "../types.js";
import type { StorageBucket } from "@betagors/yama-core";
import { formatLogEntry } from "../formatters.js";

/**
 * Parse size string (e.g., "10MB", "100KB") to bytes
 */
function parseSize(size: string): number {
  const match = size.match(/^(\d+)([KMGT]?B)$/i);
  if (!match) {
    return 10 * 1024 * 1024; // Default 10MB
  }

  const value = parseInt(match[1], 10);
  const unit = match[2].toUpperCase();

  switch (unit) {
    case "KB":
      return value * 1024;
    case "MB":
      return value * 1024 * 1024;
    case "GB":
      return value * 1024 * 1024 * 1024;
    case "TB":
      return value * 1024 * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

/**
 * Get rotated file path
 */
function getRotatedPath(path: string, index: number): string {
  const parts = path.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".");
  return `${base}.${index}${ext ? `.${ext}` : ""}`;
}

/**
 * File transport implementation
 */
export class FileTransport implements Transport {
  private config: FileTransportConfig;
  private bucket: StorageBucket | null = null;
  private buffer: string[] = [];
  private bufferSize: number;
  private currentFileSize: number = 0;
  private maxFileSize: number;
  private maxFiles: number;
  private rotationEnabled: boolean;
  private format: LogFormat;
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    config: FileTransportConfig,
    bucket: StorageBucket | null = null
  ) {
    this.config = config;
    this.bucket = bucket;
    this.format = config.format || "json";
    this.bufferSize = config.bufferSize || 10;
    this.rotationEnabled = config.rotation?.enabled ?? true;
    this.maxFileSize = config.rotation?.maxSize
      ? parseSize(config.rotation.maxSize)
      : 10 * 1024 * 1024; // Default 10MB
    this.maxFiles = config.rotation?.maxFiles || 7;

    // Auto-flush every 5 seconds if bufferSize > 0
    if (this.bufferSize > 0) {
      this.flushTimer = setInterval(() => {
        this.flush().catch((err) => {
          console.error("Error flushing file transport:", err);
        });
      }, 5000);
    }
  }

  async write(entry: LogEntry): Promise<void> {
    if (!this.bucket) {
      // Silently fail if bucket not available
      return;
    }

    const formatted = formatLogEntry(entry, this.format);
    const line = formatted + "\n";
    const lineSize = Buffer.byteLength(line, "utf8");

    // Check if we need to rotate
    if (
      this.rotationEnabled &&
      this.currentFileSize + lineSize > this.maxFileSize
    ) {
      await this.rotate();
    }

    // Add to buffer
    this.buffer.push(line);
    this.currentFileSize += lineSize;

    // Flush if buffer is full
    if (this.buffer.length >= this.bufferSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.bucket || this.buffer.length === 0) {
      return;
    }

    try {
      const content = this.buffer.join("");
      const buffer = Buffer.from(content, "utf8");

      // Check if file exists to append or create
      const exists = await this.bucket.exists(this.config.path);
      if (exists) {
        // Read existing content
        const existing = await this.bucket.download(this.config.path);
        let existingBuffer: Buffer;
        if (existing instanceof Buffer) {
          existingBuffer = existing;
        } else {
          // Convert ReadableStream to Buffer
          const chunks: Uint8Array[] = [];
          const stream = existing as ReadableStream<Uint8Array>;
          const reader = stream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          existingBuffer = Buffer.concat(chunks);
        }
        // Append new content
        const combined = Buffer.concat([existingBuffer, buffer]);
        await this.bucket.upload(this.config.path, combined);
      } else {
        // Create new file
        await this.bucket.upload(this.config.path, buffer);
      }

      this.buffer = [];
    } catch (error) {
      console.error("Error writing to file transport:", error);
      // Don't throw - fail gracefully
    }
  }

  async rotate(): Promise<void> {
    if (!this.bucket) {
      return;
    }

    try {
      // Flush current buffer first
      await this.flush();

      // Rotate files: move current to .1, .1 to .2, etc.
      for (let i = this.maxFiles - 1; i >= 1; i--) {
        const oldPath = getRotatedPath(this.config.path, i);
        const newPath = getRotatedPath(this.config.path, i + 1);

        if (await this.bucket.exists(oldPath)) {
          if (i + 1 <= this.maxFiles) {
            // Move old file to next index
            const content = await this.bucket.download(oldPath);
            let buffer: Buffer;
            if (content instanceof Buffer) {
              buffer = content;
            } else {
              // Convert ReadableStream to Buffer
              const chunks: Uint8Array[] = [];
              const stream = content as ReadableStream<Uint8Array>;
              const reader = stream.getReader();
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
              }
              buffer = Buffer.concat(chunks);
            }
            await this.bucket.upload(newPath, buffer);
          }
          // Delete old file
          await this.bucket.delete(oldPath);
        }
      }

      // Move current file to .1
      if (await this.bucket.exists(this.config.path)) {
        const content = await this.bucket.download(this.config.path);
        let buffer: Buffer;
        if (content instanceof Buffer) {
          buffer = content;
        } else {
          // Convert ReadableStream to Buffer
          const chunks: Uint8Array[] = [];
          const stream = content as ReadableStream<Uint8Array>;
          const reader = stream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
          buffer = Buffer.concat(chunks);
        }
        const rotatedPath = getRotatedPath(this.config.path, 1);
        await this.bucket.upload(rotatedPath, buffer);
        await this.bucket.delete(this.config.path);
      }

      // Reset file size counter
      this.currentFileSize = 0;
    } catch (error) {
      console.error("Error rotating log file:", error);
      // Don't throw - fail gracefully
    }
  }

  async close(): Promise<void> {
    // Clear flush timer
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining buffer
    await this.flush();
  }
}

/**
 * Create a file transport
 */
export function createFileTransport(
  config: FileTransportConfig,
  bucket: StorageBucket | null = null
): FileTransport {
  return new FileTransport(config, bucket);
}

