import { describe, it, expect } from "vitest";
import { computeDiff, diffToSteps } from "./diff.js";
import { entitiesToModel } from "./model.js";
import type { YamaEntities } from "../entities.js";

describe("Diff", () => {
  describe("computeDiff", () => {
    it("should detect added table", () => {
      const from: YamaEntities = {};
      const to: YamaEntities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid", primary: true },
            name: { type: "string" },
          },
        },
      };

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);

      expect(diff.added.tables).toContain("users");
      expect(diff.removed.tables).toHaveLength(0);
    });

    it("should detect removed table", () => {
      const from: YamaEntities = {
        User: {
          table: "users",
          fields: { id: { type: "uuid" } },
        },
      };
      const to: YamaEntities = {};

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);

      expect(diff.removed.tables).toContain("users");
      expect(diff.added.tables).toHaveLength(0);
    });

    it("should detect added column", () => {
      const from: YamaEntities = {
        User: {
          table: "users",
          fields: { id: { type: "uuid" } },
        },
      };
      const to: YamaEntities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" },
            email: { type: "string" },
          },
        },
      };

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);

      expect(diff.added.columns).toContainEqual({
        table: "users",
        column: "email",
      });
    });

    it("should detect removed column", () => {
      const from: YamaEntities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" },
            email: { type: "string" },
          },
        },
      };
      const to: YamaEntities = {
        User: {
          table: "users",
          fields: { id: { type: "uuid" } },
        },
      };

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);

      expect(diff.removed.columns).toContainEqual({
        table: "users",
        column: "email",
      });
    });

    it("should detect modified column", () => {
      const from: YamaEntities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" },
            name: { type: "string", maxLength: 100 },
          },
        },
      };
      const to: YamaEntities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" },
            name: { type: "string", maxLength: 255 },
          },
        },
      };

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);

      expect(diff.modified.columns.length).toBeGreaterThan(0);
      expect(diff.modified.columns[0].table).toBe("users");
      expect(diff.modified.columns[0].column).toBe("name");
    });

    it("should detect no changes", () => {
      const entities: YamaEntities = {
        User: {
          table: "users",
          fields: { id: { type: "uuid" }, name: { type: "string" } },
        },
      };

      const model = entitiesToModel(entities);
      const diff = computeDiff(model, model);

      expect(diff.added.tables).toHaveLength(0);
      expect(diff.removed.tables).toHaveLength(0);
      expect(diff.added.columns).toHaveLength(0);
      expect(diff.removed.columns).toHaveLength(0);
      expect(diff.modified.columns).toHaveLength(0);
    });
  });

  describe("diffToSteps", () => {
    it("should generate add_table step", () => {
      const from: YamaEntities = {};
      const to: YamaEntities = {
        Post: {
          table: "posts",
          fields: {
            id: { type: "uuid", primary: true },
            title: { type: "string" },
          },
        },
      };

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);
      const steps = diffToSteps(diff, fromModel, toModel);

      expect(steps).toHaveLength(1);
      expect(steps[0].type).toBe("add_table");
      expect(steps[0].table).toBe("posts");
      if (steps[0].type === "add_table") {
        expect(steps[0].columns).toHaveLength(2);
      }
    });

    it("should generate drop_table step", () => {
      const from: YamaEntities = {
        Post: {
          table: "posts",
          fields: { id: { type: "uuid" } },
        },
      };
      const to: YamaEntities = {};

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);
      const steps = diffToSteps(diff, fromModel, toModel);

      expect(steps.some((s) => s.type === "drop_table")).toBe(true);
    });

    it("should generate add_column step", () => {
      const from: YamaEntities = {
        User: {
          table: "users",
          fields: { id: { type: "uuid" } },
        },
      };
      const to: YamaEntities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" },
            bio: { type: "text" },
          },
        },
      };

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);
      const steps = diffToSteps(diff, fromModel, toModel);

      const addStep = steps.find((s) => s.type === "add_column");
      expect(addStep).toBeDefined();
      if (addStep && addStep.type === "add_column") {
        expect(addStep.column.name).toBe("bio");
      }
    });

    it("should generate drop_column step", () => {
      const from: YamaEntities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" },
            deprecated: { type: "string" },
          },
        },
      };
      const to: YamaEntities = {
        User: {
          table: "users",
          fields: { id: { type: "uuid" } },
        },
      };

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);
      const steps = diffToSteps(diff, fromModel, toModel);

      const dropStep = steps.find((s) => s.type === "drop_column");
      expect(dropStep).toBeDefined();
      if (dropStep && dropStep.type === "drop_column") {
        expect(dropStep.column).toBe("deprecated");
      }
    });

    it("should order steps correctly (add tables before columns)", () => {
      const from: YamaEntities = {};
      const to: YamaEntities = {
        User: {
          table: "users",
          fields: {
            id: { type: "uuid" },
            name: { type: "string" },
          },
          indexes: [{ fields: ["name"], unique: false }],
        },
      };

      const fromModel = entitiesToModel(from);
      const toModel = entitiesToModel(to);
      const diff = computeDiff(fromModel, toModel);
      const steps = diffToSteps(diff, fromModel, toModel);

      // add_table should come before add_index
      const tableIdx = steps.findIndex((s) => s.type === "add_table");
      const indexIdx = steps.findIndex((s) => s.type === "add_index");
      
      if (tableIdx !== -1 && indexIdx !== -1) {
        expect(tableIdx).toBeLessThan(indexIdx);
      }
    });
  });
});
