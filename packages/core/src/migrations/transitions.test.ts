import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createTransition,
  saveTransition,
  loadTransition,
  transitionExists,
  getAllTransitions,
  deleteTransition,
} from "./transitions.js";
import type { MigrationStepUnion } from "./diff.js";

describe("Transitions", () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `yama-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  const testSteps: MigrationStepUnion[] = [
    {
      type: "add_table",
      table: "users",
      columns: [
        { name: "id", type: "UUID", nullable: false, primary: true },
        { name: "name", type: "VARCHAR(255)", nullable: false },
      ],
    },
    {
      type: "add_index",
      table: "users",
      index: { name: "users_name_idx", columns: ["name"], unique: false },
    },
  ];

  describe("createTransition", () => {
    it("should create a transition with hash", () => {
      const transition = createTransition("from-hash", "to-hash", testSteps, {
        description: "Test transition",
        createdAt: new Date().toISOString(),
      });

      expect(transition.hash).toBeDefined();
      expect(transition.hash).toHaveLength(64);
      expect(transition.fromHash).toBe("from-hash");
      expect(transition.toHash).toBe("to-hash");
      expect(transition.steps).toEqual(testSteps);
    });

    it("should generate same hash for same content", () => {
      const t1 = createTransition("from", "to", testSteps, {
        description: "First",
        createdAt: "2024-01-01",
      });
      const t2 = createTransition("from", "to", testSteps, {
        description: "Second",
        createdAt: "2024-01-02",
      });

      expect(t1.hash).toBe(t2.hash);
    });

    it("should generate different hash for different steps", () => {
      const t1 = createTransition("from", "to", testSteps, {
        createdAt: new Date().toISOString(),
      });
      const t2 = createTransition("from", "to", [testSteps[0]], {
        createdAt: new Date().toISOString(),
      });

      expect(t1.hash).not.toBe(t2.hash);
    });
  });

  describe("saveTransition and loadTransition", () => {
    it("should save and load transition", () => {
      const transition = createTransition("from", "to", testSteps, {
        description: "Test",
        createdAt: new Date().toISOString(),
      });

      saveTransition(testDir, transition);
      expect(transitionExists(testDir, transition.hash)).toBe(true);

      const loaded = loadTransition(testDir, transition.hash);
      expect(loaded).toBeDefined();
      expect(loaded!.hash).toBe(transition.hash);
      expect(loaded!.steps).toEqual(testSteps);
    });

    it("should return null for non-existent transition", () => {
      const loaded = loadTransition(testDir, "non-existent");
      expect(loaded).toBeNull();
    });
  });

  describe("getAllTransitions", () => {
    it("should return all transitions", () => {
      const t1 = createTransition("a", "b", testSteps, {
        createdAt: new Date().toISOString(),
      });
      const t2 = createTransition("b", "c", [testSteps[0]], {
        createdAt: new Date().toISOString(),
      });

      saveTransition(testDir, t1);
      saveTransition(testDir, t2);

      const all = getAllTransitions(testDir);
      expect(all).toHaveLength(2);
    });
  });

  describe("deleteTransition", () => {
    it("should delete transition", () => {
      const transition = createTransition("from", "to", testSteps, {
        createdAt: new Date().toISOString(),
      });

      saveTransition(testDir, transition);
      expect(transitionExists(testDir, transition.hash)).toBe(true);

      deleteTransition(testDir, transition.hash);
      expect(transitionExists(testDir, transition.hash)).toBe(false);
    });
  });
});
