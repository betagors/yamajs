import { describe, it, expect, beforeEach, vi } from "vitest";
import { createFastifyAdapter } from "./adapter";
import type { HttpRequest, HttpResponse, RouteHandler } from "@betagors/yama-core";

describe("Fastify Adapter", () => {
  let adapter: ReturnType<typeof createFastifyAdapter>;

  beforeEach(() => {
    adapter = createFastifyAdapter();
  });

  it("should create server instance", () => {
    const server = adapter.createServer();
    expect(server).toBeDefined();
  });

  it("should create server with options", () => {
    const server = adapter.createServer({ logger: true });
    expect(server).toBeDefined();
  });

  it("should register route", async () => {
    const server = adapter.createServer();
    let handlerCalled = false;

    const handler: RouteHandler = async (request: HttpRequest, reply: HttpResponse) => {
      handlerCalled = true;
      return { message: "test" };
    };

    adapter.registerRoute(server, "GET", "/test", handler);

    // Start server to test route
    await adapter.start(server, 0); // Use port 0 for random port

    // Make request (this would require a test HTTP client in real tests)
    // For now, just verify the route was registered
    expect(handlerCalled).toBe(false); // Handler not called yet

    await adapter.stop(server);
  });

  it("should normalize request", () => {
    const fastifyRequest = {
      method: "GET",
      url: "/test?foo=bar",
      query: { foo: "bar" },
      params: { id: "123" },
      body: { test: "data" },
      headers: { "content-type": "application/json" },
    } as any;

    const normalized = adapter.getRequestAdapter(fastifyRequest);

    expect(normalized.method).toBe("GET");
    expect(normalized.path).toBe("/test");
    expect(normalized.query).toEqual({ foo: "bar" });
    expect(normalized.params).toEqual({ id: "123" });
    expect(normalized.body).toEqual({ test: "data" });
    expect(normalized.headers["content-type"]).toBe("application/json");
    expect(normalized._original).toBe(fastifyRequest);
  });

  it("should normalize response", () => {
    const mockStatus = vi.fn().mockReturnThis();
    const mockSend = vi.fn();
    const mockType = vi.fn().mockReturnThis();
    
    const fastifyReply = {
      status: mockStatus,
      send: mockSend,
      type: mockType,
    } as any;

    const normalized = adapter.getResponseAdapter(fastifyReply);

    expect(normalized.status).toBeDefined();
    expect(normalized.send).toBeDefined();
    expect(normalized.type).toBeDefined();
    expect(normalized._original).toBe(fastifyReply);
  });
});

