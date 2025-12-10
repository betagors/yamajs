import { describe, it, expect } from "vitest";
import {
  validateManifest,
  validateYamaPlugin,
} from "./validator";
import type { PluginManifest, YamaPlugin } from "./base";

describe("Plugin Validator", () => {
  describe("validateManifest", () => {
    it("should validate correct manifest", () => {
      const manifest: PluginManifest = {
        pluginApi: "1.0",
        yamaCore: "^0.1.0",
        category: "database",
        type: "payment",
        service: "stripe",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it("should validate manifest with optional fields", () => {
      const manifest: PluginManifest = {
        category: "database",
      };

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });

    it("should validate empty manifest", () => {
      const manifest: PluginManifest = {};

      const result = validateManifest(manifest);
      expect(result.valid).toBe(true);
    });
  });

  describe("validateYamaPlugin", () => {
    it("should validate correct plugin", () => {
      const plugin: YamaPlugin = {
        name: "@betagors/yama-plugin-postgres",
        version: "1.0.0",
        category: "database",
        init: async () => ({ adapter: {} }),
      };

      const result = validateYamaPlugin(plugin);
      expect(result.valid).toBe(true);
    });

    it("should validate plugin without optional fields", () => {
      const plugin: YamaPlugin = {
        name: "@betagors/yama-plugin-test",
        init: async () => ({}),
      };

      const result = validateYamaPlugin(plugin);
      expect(result.valid).toBe(true);
    });

    it("should reject plugin without init method", () => {
      const plugin = {
        name: "@betagors/yama-plugin-test",
      } as YamaPlugin;

      const result = validateYamaPlugin(plugin);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Plugin must implement init() method");
    });

    it("should reject plugin without name", () => {
      const plugin = {
        init: async () => ({}),
      } as YamaPlugin;

      const result = validateYamaPlugin(plugin);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Plugin must have a name property (string)");
    });

    it("should reject non-object plugin", () => {
      const result = validateYamaPlugin(null as any);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Plugin must be an object");
    });
  });

});

