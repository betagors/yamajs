import { describe, it, expect } from "vitest";
import { generateIR } from "./generator.js";

describe("generateIR", () => {
  it("builds IR with endpoints and schemas", () => {
    const ir = generateIR({
      name: "demo",
      version: "1.0.0",
      apis: {
        rest: {
          endpoints: [
            { method: "GET", path: "/hello" },
            { method: "POST", path: "/items", body: { type: "Item" } },
          ],
        },
      },
      schemas: {
        Item: {
          type: "object",
          properties: {
            id: { type: "string" },
          },
          required: ["id"],
        },
      },
    } as any);

    expect(ir.irVersion).toBe("0.1.0");
    expect(ir.name).toBe("demo");
    expect(ir.endpoints).toHaveLength(2);
    expect(ir.schemas).toHaveProperty("Item");
    expect(ir.endpoints[0].path).toBe("/hello");
  });
});

