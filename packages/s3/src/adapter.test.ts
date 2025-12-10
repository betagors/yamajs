import { describe, it, expect, vi, beforeEach } from "vitest";
import { createS3Adapter, createS3Bucket } from "./adapter.js";
import type { S3AdapterConfig } from "./adapter.js";

// Mock AWS SDK
vi.mock("@aws-sdk/client-s3", () => {
  const mockSend = vi.fn();
  return {
    GetObjectCommand: vi.fn(),
    PutObjectCommand: vi.fn(),
    DeleteObjectCommand: vi.fn(),
    HeadObjectCommand: vi.fn(),
    ListObjectsV2Command: vi.fn(),
    CopyObjectCommand: vi.fn(),
  };
});

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn().mockResolvedValue("https://signed-url.example.com/object"),
}));

vi.mock("./client", () => ({
  initS3Client: vi.fn(() => ({
    send: vi.fn(),
  })),
  getS3Client: vi.fn(() => ({
    send: vi.fn(),
  })),
}));

describe("S3 Adapter", () => {
  let config: S3AdapterConfig;
  let mockClient: { send: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockClient = {
      send: vi.fn(),
    };

    config = {
      bucket: "test-bucket",
      region: "us-east-1",
      accessKeyId: "test-key",
      secretAccessKey: "test-secret",
    };

    // Mock client.send to return appropriate responses
    vi.mocked(require("./client").initS3Client).mockReturnValue(mockClient as any);
  });

  describe("createS3Adapter", () => {
    it("should create adapter with valid config", () => {
      const adapter = createS3Adapter(config);

      expect(adapter).toBeDefined();
      expect(adapter.upload).toBeDefined();
      expect(adapter.download).toBeDefined();
      expect(adapter.delete).toBeDefined();
      expect(adapter.exists).toBeDefined();
      expect(adapter.getUrl).toBeDefined();
      expect(adapter.list).toBeDefined();
      expect(adapter.getMetadata).toBeDefined();
      expect(adapter.copy).toBeDefined();
    });

    it("should upload buffer data", async () => {
      const adapter = createS3Adapter(config);
      const key = "test-file.txt";
      const data = Buffer.from("Hello, World!");

      mockClient.send.mockResolvedValue({
        ETag: '"etag123"',
        VersionId: "version1",
      });

      const result = await adapter.upload(key, data);

      expect(result.key).toBe(key);
      expect(result.size).toBe(data.length);
      expect(result.etag).toBe('"etag123"');
      expect(result.versionId).toBe("version1");
      expect(mockClient.send).toHaveBeenCalled();
    });

    it("should upload ReadableStream data", async () => {
      const adapter = createS3Adapter(config);
      const key = "test-stream.txt";
      const text = "Stream content";
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(text));
          controller.close();
        },
      });

      mockClient.send.mockResolvedValue({
        ETag: '"etag456"',
      });

      const result = await adapter.upload(key, stream);

      expect(result.key).toBe(key);
      expect(result.size).toBeGreaterThan(0);
      expect(mockClient.send).toHaveBeenCalled();
    });

    it("should throw error for invalid data type", async () => {
      const adapter = createS3Adapter(config);
      const key = "test.txt";
      const invalidData = "not a buffer or stream" as any;

      await expect(adapter.upload(key, invalidData)).rejects.toThrow(
        "Invalid data type"
      );
    });

    it("should download file", async () => {
      const adapter = createS3Adapter(config);
      const key = "test-file.txt";
      const content = Buffer.from("File content");

      // Mock Readable stream
      const mockStream = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === "data") {
            setTimeout(() => handler(content), 0);
          } else if (event === "end") {
            setTimeout(() => handler(), 0);
          }
          return mockStream;
        }),
      };

      mockClient.send.mockResolvedValue({
        Body: mockStream,
      });

      const result = await adapter.download(key);

      expect(result).toBeInstanceOf(Buffer);
      expect(mockClient.send).toHaveBeenCalled();
    });

    it("should throw error when object not found", async () => {
      const adapter = createS3Adapter(config);
      const key = "non-existent.txt";

      mockClient.send.mockResolvedValue({
        Body: null,
      });

      await expect(adapter.download(key)).rejects.toThrow("not found or empty");
    });

    it("should delete object", async () => {
      const adapter = createS3Adapter(config);
      const key = "test-file.txt";

      mockClient.send.mockResolvedValue({});

      await adapter.delete(key);

      expect(mockClient.send).toHaveBeenCalled();
    });

    it("should check if object exists", async () => {
      const adapter = createS3Adapter(config);
      const key = "test-file.txt";

      mockClient.send.mockResolvedValue({
        ContentLength: 100,
      });

      const exists = await adapter.exists(key);

      expect(exists).toBe(true);
      expect(mockClient.send).toHaveBeenCalled();
    });

    it("should return false when object does not exist", async () => {
      const adapter = createS3Adapter(config);
      const key = "non-existent.txt";

      const error = new Error("Not found");
      (error as any).name = "NotFound";
      mockClient.send.mockRejectedValue(error);

      const exists = await adapter.exists(key);

      expect(exists).toBe(false);
    });

    it("should generate signed URL for private bucket", async () => {
      const adapter = createS3Adapter({
        ...config,
        public: false,
      });
      const key = "test-file.txt";

      const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");
      const url = await adapter.getUrl(key, 3600);

      expect(url).toBe("https://signed-url.example.com/object");
      expect(getSignedUrl).toHaveBeenCalled();
    });

    it("should return direct URL for public bucket", async () => {
      const adapter = createS3Adapter({
        ...config,
        public: true,
      });
      const key = "test-file.txt";

      const url = await adapter.getUrl(key);

      expect(url).toContain("test-bucket");
      expect(url).toContain(key);
    });

    it("should list objects", async () => {
      const adapter = createS3Adapter(config);

      mockClient.send
        .mockResolvedValueOnce({
          Contents: [
            { Key: "file1.txt" },
            { Key: "file2.txt" },
          ],
          NextContinuationToken: "token123",
        })
        .mockResolvedValueOnce({
          Contents: [{ Key: "file3.txt" }],
        });

      const keys = await adapter.list();

      expect(keys).toContain("file1.txt");
      expect(keys).toContain("file2.txt");
      expect(keys).toContain("file3.txt");
      expect(mockClient.send).toHaveBeenCalledTimes(2);
    });

    it("should list objects with prefix", async () => {
      const adapter = createS3Adapter(config);

      mockClient.send.mockResolvedValue({
        Contents: [{ Key: "prefix/file1.txt" }],
      });

      const keys = await adapter.list("prefix/");

      expect(keys).toContain("prefix/file1.txt");
      expect(mockClient.send).toHaveBeenCalled();
    });

    it("should get metadata for existing object", async () => {
      const adapter = createS3Adapter(config);
      const key = "test-file.txt";

      mockClient.send.mockResolvedValue({
        ContentLength: 100,
        ContentType: "text/plain",
        LastModified: new Date(),
        ETag: '"etag123"',
        Metadata: { custom: "value" },
      });

      const metadata = await adapter.getMetadata(key);

      expect(metadata).not.toBeNull();
      expect(metadata?.key).toBe(key);
      expect(metadata?.size).toBe(100);
      expect(metadata?.contentType).toBe("text/plain");
      expect(metadata?.etag).toBe('"etag123"');
    });

    it("should return null for non-existent object metadata", async () => {
      const adapter = createS3Adapter(config);
      const key = "non-existent.txt";

      const error = new Error("Not found");
      (error as any).name = "NotFound";
      mockClient.send.mockRejectedValue(error);

      const metadata = await adapter.getMetadata(key);

      expect(metadata).toBeNull();
    });

    it("should copy object", async () => {
      const adapter = createS3Adapter(config);
      const sourceKey = "source.txt";
      const destKey = "dest.txt";

      mockClient.send.mockResolvedValue({});

      await adapter.copy(sourceKey, destKey);

      expect(mockClient.send).toHaveBeenCalled();
    });
  });

  describe("createS3Bucket", () => {
    it("should create bucket with same interface as adapter", async () => {
      const bucket = createS3Bucket(config);
      const key = "test-file.txt";
      const data = Buffer.from("Bucket test");

      mockClient.send.mockResolvedValue({
        ETag: '"etag123"',
      });

      await bucket.upload(key, data);

      expect(mockClient.send).toHaveBeenCalled();
    });

    it("should support all bucket methods", async () => {
      const bucket = createS3Bucket(config);
      const key = "test-file.txt";

      mockClient.send
        .mockResolvedValueOnce({ ETag: '"etag123"' }) // upload
        .mockResolvedValueOnce({ ContentLength: 100 }) // exists
        .mockResolvedValueOnce({
          ContentLength: 100,
          LastModified: new Date(),
        }) // getMetadata
        .mockResolvedValueOnce({}) // copy
        .mockResolvedValueOnce({}); // delete

      await bucket.upload(key, Buffer.from("test"));
      expect(await bucket.exists(key)).toBe(true);

      const metadata = await bucket.getMetadata(key);
      expect(metadata).not.toBeNull();

      await bucket.copy(key, "copy.txt");
      await bucket.delete(key);

      expect(mockClient.send).toHaveBeenCalledTimes(5);
    });
  });
});

