import Fastify, { FastifyRequest, FastifyReply, FastifyInstance } from "fastify";
import type {
  HttpServerAdapter,
  HttpServerInstance,
  HttpRequest,
  HttpResponse,
  RouteHandler,
} from "@betagors/yama-core";

/**
 * Fastify HTTP server adapter
 */
export function createFastifyAdapter(
  options?: Record<string, unknown>
): HttpServerAdapter {
  return {
    createServer(serverOptions?: Record<string, unknown>): HttpServerInstance {
      const mergedOptions = { ...options, ...serverOptions };
      return Fastify(mergedOptions);
    },

    registerRoute(
      server: HttpServerInstance,
      method: string,
      path: string,
      handler: RouteHandler
    ): void {
      const app = server as FastifyInstance;
      const methodLower = method.toLowerCase() as
        | "get"
        | "post"
        | "put"
        | "patch"
        | "delete"
        | "head"
        | "options";

      app[methodLower](path, async (request: FastifyRequest, reply: FastifyReply) => {
        const normalizedRequest = this.getRequestAdapter(request);
        const normalizedReply = this.getResponseAdapter(reply);
        return await handler(normalizedRequest, normalizedReply);
      });
    },

    async start(
      server: HttpServerInstance,
      port: number,
      host: string = "0.0.0.0"
    ): Promise<void> {
      const app = server as FastifyInstance;
      await app.listen({ port, host });
    },

    async stop(server: HttpServerInstance): Promise<void> {
      const app = server as FastifyInstance;
      await app.close();
    },

    getRequestAdapter(request: unknown): HttpRequest {
      const req = request as FastifyRequest;
      const headers: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        headers[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
      }

      return {
        method: req.method,
        url: req.url,
        path: req.url.split("?")[0],
        query: (req.query as Record<string, unknown>) || {},
        params: (req.params as Record<string, unknown>) || {},
        body: req.body,
        headers,
        // Preserve original request for advanced use cases
        _original: req,
      };
    },

    getResponseAdapter(reply: unknown): HttpResponse {
      const res = reply as FastifyReply;
      return {
        status(code: number): HttpResponse {
          res.status(code);
          return this;
        },
        send(data: unknown): void {
          res.send(data);
        },
        type(contentType: string): HttpResponse {
          res.type(contentType);
          return this;
        },
        // Preserve original reply for advanced use cases
        _original: res,
      };
    },
  };
}

