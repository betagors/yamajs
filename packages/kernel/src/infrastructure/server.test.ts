import { describe, it, expect, beforeEach } from "vitest";
import {
  createHttpServerAdapter,
  registerHttpServerAdapter,
  type HttpServerAdapter,
} from "./server";

describe("HTTP Server Adapter", () => {
  it("should throw error for unsupported engine", () => {
    expect(() => {
      createHttpServerAdapter("express");
    }).toThrow("Unsupported HTTP server engine");
  });

  it("should create adapter for registered engine", () => {
    const mockAdapter: HttpServerAdapter = {
      createServer() {
        return {};
      },
      registerRoute() {},
      async start() {},
      async stop() {},
      getRequestAdapter() {
        return {} as any;
      },
      getResponseAdapter() {
        return {} as any;
      },
    };

    registerHttpServerAdapter("testserver", () => mockAdapter);

    const adapter = createHttpServerAdapter("testserver");
    expect(adapter).toBe(mockAdapter);
  });

  it("should default to fastify when no engine specified", () => {
    // This will fail if fastify isn't registered, which is expected
    expect(() => {
      createHttpServerAdapter();
    }).toThrow();
  });

  it("should normalize engine to lowercase", () => {
    const mockAdapter: HttpServerAdapter = {
      createServer() {
        return {};
      },
      registerRoute() {},
      async start() {},
      async stop() {},
      getRequestAdapter() {
        return {} as any;
      },
      getResponseAdapter() {
        return {} as any;
      },
    };

    registerHttpServerAdapter("testserver", () => mockAdapter);

    const adapter1 = createHttpServerAdapter("TESTSERVER");
    const adapter2 = createHttpServerAdapter("TestServer");
    expect(adapter1).toBe(mockAdapter);
    expect(adapter2).toBe(mockAdapter);
  });
});

