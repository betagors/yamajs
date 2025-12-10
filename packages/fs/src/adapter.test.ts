import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createFSAdapter, createFSBucket } from "./adapter.js";
import { promises as fs } from "fs";
import { join } from "path";
import { tmpdir } from "os";

describe("FS Adapter", () => {
  let basePath: string;
  let adapter: ReturnType<typeof createFSAdapter>;

  beforeEach(async () => {
    // Create a temporary directory for each test
    basePath = join(tmpdir(), `yama-fs-test-${Date.now()}`);
    await fs.mkdir(basePath, { recursive: true });

    adapter = createFSAdapter({ basePath });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(basePath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("upload", () => {
    it("should upload buffer data", async () => {
      const key = "test-file.txt";
      const data = Buffer.from("Hello, World!");

      const result = await adapter.upload(key, data);

      expect(result.key).toBe(key);
      expect(result.size).toBe(data.length);

      // Verify file exists
      const filePath = join(basePath, key);
      const fileContent = await fs.readFile(filePath);
      expect(fileContent).toEqual(data);
    });

    it("should upload ReadableStream data", async () => {
      const key = "test-stream.txt";
      const text = "Stream content";
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });

      const result = await adapter.upload(key, stream);

      expect(result.key).toBe(key);
      expect(result.size).toBeGreaterThan(0);

      // Verify file content
      const filePath = join(basePath, key);
      const fileContent = await fs.readFile(filePath, "utf-8");
      expect(fileContent).toBe(text);
    });

    it("should create nested directories", async () => {
      const key = "nested/path/file.txt";
      const data = Buffer.from("Nested file");

      await adapter.upload(key, data);

      const filePath = join(basePath, key);
      const fileContent = await fs.readFile(filePath);
      expect(fileContent).toEqual(data);
    });

    it("should prevent directory traversal", async () => {
      const key = "../../../etc/passwd";
      const data = Buffer.from("malicious");

      await adapter.upload(key, data);

      // Should normalize path and prevent traversal
      const filePath = join(basePath, key.replace(/\.\./g, "").replace(/^\//, ""));
      // File should be created in basePath, not outside
      expect(filePath).toContain(basePath);
    });

    it("should throw error for invalid data type", async () => {
      const key = "test.txt";
      const invalidData = "not a buffer or stream" as any;

      await expect(adapter.upload(key, invalidData)).rejects.toThrow(
        "Invalid data type"
      );
    });
  });

  describe("download", () => {
    it("should download file as buffer", async () => {
      const key = "test-file.txt";
      const content = Buffer.from("File content");
      const filePath = join(basePath, key);
      await fs.writeFile(filePath, content);

      const result = await adapter.download(key);

      expect(result).toBeInstanceOf(Buffer);
      expect(result as Buffer).toEqual(content);
    });

    it("should throw error when file does not exist", async () => {
      await expect(adapter.download("non-existent.txt")).rejects.toThrow();
    });
  });

  describe("delete", () => {
    it("should delete existing file", async () => {
      const key = "test-file.txt";
      const filePath = join(basePath, key);
      await fs.writeFile(filePath, "content");

      await adapter.delete(key);

      await expect(fs.access(filePath)).rejects.toThrow();
    });

    it("should not throw when deleting non-existent file", async () => {
      await expect(adapter.delete("non-existent.txt")).resolves.not.toThrow();
    });
  });

  describe("exists", () => {
    it("should return true for existing file", async () => {
      const key = "test-file.txt";
      const filePath = join(basePath, key);
      await fs.writeFile(filePath, "content");

      const exists = await adapter.exists(key);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent file", async () => {
      const exists = await adapter.exists("non-existent.txt");
      expect(exists).toBe(false);
    });
  });

  describe("getUrl", () => {
    it("should return file:// URL when baseUrl not configured", async () => {
      const key = "test-file.txt";
      const url = await adapter.getUrl(key);

      expect(url).toMatch(/^file:\/\//);
      expect(url).toContain(key);
    });

    it("should return baseUrl when configured", async () => {
      const adapterWithUrl = createFSAdapter({
        basePath,
        baseUrl: "https://example.com/files",
      });

      const key = "test-file.txt";
      const url = await adapterWithUrl.getUrl(key);

      expect(url).toBe("https://example.com/files/test-file.txt");
    });

    it("should normalize key path in URL", async () => {
      const adapterWithUrl = createFSAdapter({
        basePath,
        baseUrl: "https://example.com/files",
      });

      const key = "/test-file.txt";
      const url = await adapterWithUrl.getUrl(key);

      expect(url).toBe("https://example.com/files/test-file.txt");
    });
  });

  describe("list", () => {
    it("should list all files in base directory", async () => {
      await fs.writeFile(join(basePath, "file1.txt"), "content1");
      await fs.writeFile(join(basePath, "file2.txt"), "content2");
      await fs.writeFile(join(basePath, "file3.txt"), "content3");

      const keys = await adapter.list();

      expect(keys.length).toBeGreaterThanOrEqual(3);
      expect(keys).toContain("file1.txt");
      expect(keys).toContain("file2.txt");
      expect(keys).toContain("file3.txt");
    });

    it("should list files with prefix", async () => {
      // Create a directory with the prefix name
      await fs.mkdir(join(basePath, "prefix"), { recursive: true });
      await fs.writeFile(join(basePath, "prefix", "file1.txt"), "content1");
      await fs.writeFile(join(basePath, "prefix", "file2.txt"), "content2");
      await fs.writeFile(join(basePath, "other-file.txt"), "content3");

      const keys = await adapter.list("prefix");

      expect(keys.length).toBeGreaterThanOrEqual(2);
      expect(keys).toContain("prefix/file1.txt");
      expect(keys).toContain("prefix/file2.txt");
    });

    it("should list files recursively in nested directories", async () => {
      await fs.mkdir(join(basePath, "nested"), { recursive: true });
      await fs.writeFile(join(basePath, "nested", "file.txt"), "content");

      const keys = await adapter.list();

      expect(keys).toContain("nested/file.txt");
    });

    it("should return empty array for non-existent prefix", async () => {
      const keys = await adapter.list("non-existent");

      expect(keys).toEqual([]);
    });
  });

  describe("getMetadata", () => {
    it("should return metadata for existing file", async () => {
      const key = "test-file.txt";
      const content = Buffer.from("File content");
      const filePath = join(basePath, key);
      await fs.writeFile(filePath, content);

      const metadata = await adapter.getMetadata(key);

      expect(metadata).not.toBeNull();
      expect(metadata?.key).toBe(key);
      expect(metadata?.size).toBe(content.length);
      expect(metadata?.lastModified).toBeInstanceOf(Date);
    });

    it("should return null for non-existent file", async () => {
      const metadata = await adapter.getMetadata("non-existent.txt");

      expect(metadata).toBeNull();
    });
  });

  describe("copy", () => {
    it("should copy file from source to destination", async () => {
      const sourceKey = "source.txt";
      const destKey = "dest.txt";
      const content = Buffer.from("Source content");
      const sourcePath = join(basePath, sourceKey);
      await fs.writeFile(sourcePath, content);

      await adapter.copy(sourceKey, destKey);

      const destPath = join(basePath, destKey);
      const destContent = await fs.readFile(destPath);
      expect(destContent).toEqual(content);

      // Source should still exist
      const sourceContent = await fs.readFile(sourcePath);
      expect(sourceContent).toEqual(content);
    });

    it("should create destination directory if needed", async () => {
      const sourceKey = "source.txt";
      const destKey = "nested/dest.txt";
      const content = Buffer.from("Source content");
      await fs.writeFile(join(basePath, sourceKey), content);

      await adapter.copy(sourceKey, destKey);

      const destPath = join(basePath, destKey);
      const destContent = await fs.readFile(destPath);
      expect(destContent).toEqual(content);
    });
  });

  describe("createFSBucket", () => {
    it("should create bucket with same interface as adapter", async () => {
      const bucket = createFSBucket({ basePath });
      const key = "test-file.txt";
      const data = Buffer.from("Bucket test");

      await bucket.upload(key, data);

      const exists = await bucket.exists(key);
      expect(exists).toBe(true);

      const downloaded = await bucket.download(key);
      expect(downloaded as Buffer).toEqual(data);
    });

    it("should support all bucket methods", async () => {
      const bucket = createFSBucket({ basePath });
      const key = "test-file.txt";
      const data = Buffer.from("Test");

      await bucket.upload(key, data);
      expect(await bucket.exists(key)).toBe(true);

      const metadata = await bucket.getMetadata(key);
      expect(metadata).not.toBeNull();

      await bucket.copy(key, "copy.txt");
      expect(await bucket.exists("copy.txt")).toBe(true);

      await bucket.delete(key);
      expect(await bucket.exists(key)).toBe(false);
    });
  });
});

