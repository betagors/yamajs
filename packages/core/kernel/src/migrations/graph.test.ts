import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  buildGraph,
  loadGraph,
  findPath,
  findReversePath,
  pathExists,
  getReachableSnapshots,
} from "./graph.js";
import { createSnapshot, saveSnapshot } from "./snapshots.js";
import { createTransition, saveTransition } from "./transitions.js";
import type { YamaEntities } from "../entities.js";
import type { MigrationStepUnion } from "./diff.js";

describe("Graph", () => {
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

  function createTestEntities(id: string): YamaEntities {
    return {
      Entity: {
        table: `table_${id}`,
        fields: { id: { type: "uuid" } },
      },
    };
  }

  function createTestSteps(): MigrationStepUnion[] {
    return [
      {
        type: "add_table",
        table: "test",
        columns: [{ name: "id", type: "UUID", nullable: false }],
      },
    ];
  }

  describe("buildGraph", () => {
    it("should build empty graph", () => {
      const graph = buildGraph(testDir);
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
    });

    it("should build graph with snapshots and transitions", () => {
      // Create snapshots
      const s1 = createSnapshot(createTestEntities("1"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s2 = createSnapshot(createTestEntities("2"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s3 = createSnapshot(createTestEntities("3"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, s1);
      saveSnapshot(testDir, s2);
      saveSnapshot(testDir, s3);

      // Create transitions: s1 -> s2 -> s3
      const t1 = createTransition(s1.hash, s2.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });
      const t2 = createTransition(s2.hash, s3.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });

      saveTransition(testDir, t1);
      saveTransition(testDir, t2);

      const graph = buildGraph(testDir);
      expect(graph.nodes.size).toBe(3);
      expect(graph.transitions.size).toBe(2);
    });
  });

  describe("findPath", () => {
    it("should find direct path", () => {
      const s1 = createSnapshot(createTestEntities("a"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s2 = createSnapshot(createTestEntities("b"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, s1);
      saveSnapshot(testDir, s2);

      const t = createTransition(s1.hash, s2.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });
      saveTransition(testDir, t);
      buildGraph(testDir);

      const path = findPath(testDir, s1.hash, s2.hash);
      expect(path).not.toBeNull();
      expect(path!.transitions).toHaveLength(1);
      expect(path!.transitions[0].hash).toBe(t.hash);
    });

    it("should find multi-step path", () => {
      const s1 = createSnapshot(createTestEntities("x"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s2 = createSnapshot(createTestEntities("y"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s3 = createSnapshot(createTestEntities("z"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, s1);
      saveSnapshot(testDir, s2);
      saveSnapshot(testDir, s3);

      const t1 = createTransition(s1.hash, s2.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });
      const t2 = createTransition(s2.hash, s3.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });

      saveTransition(testDir, t1);
      saveTransition(testDir, t2);
      buildGraph(testDir);

      const path = findPath(testDir, s1.hash, s3.hash);
      expect(path).not.toBeNull();
      expect(path!.transitions).toHaveLength(2);
    });

    it("should return null for no path", () => {
      const s1 = createSnapshot(createTestEntities("m"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s2 = createSnapshot(createTestEntities("n"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, s1);
      saveSnapshot(testDir, s2);
      buildGraph(testDir);

      // No transition between them
      const path = findPath(testDir, s1.hash, s2.hash);
      expect(path).toBeNull();
    });
  });

  describe("findReversePath", () => {
    it("should find reverse path", () => {
      const s1 = createSnapshot(createTestEntities("p"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s2 = createSnapshot(createTestEntities("q"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, s1);
      saveSnapshot(testDir, s2);

      const t = createTransition(s1.hash, s2.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });
      saveTransition(testDir, t);
      buildGraph(testDir);

      const path = findReversePath(testDir, s2.hash, s1.hash);
      expect(path).not.toBeNull();
      expect(path!.transitions).toHaveLength(1);
    });
  });

  describe("pathExists", () => {
    it("should check path existence", () => {
      const s1 = createSnapshot(createTestEntities("r"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s2 = createSnapshot(createTestEntities("s"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, s1);
      saveSnapshot(testDir, s2);

      const t = createTransition(s1.hash, s2.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });
      saveTransition(testDir, t);
      buildGraph(testDir);

      expect(pathExists(testDir, s1.hash, s2.hash)).toBe(true);
      expect(pathExists(testDir, s2.hash, s1.hash)).toBe(false); // Wrong direction
    });
  });

  describe("getReachableSnapshots", () => {
    it("should get reachable snapshots", () => {
      const s1 = createSnapshot(createTestEntities("t"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s2 = createSnapshot(createTestEntities("u"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const s3 = createSnapshot(createTestEntities("v"), {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, s1);
      saveSnapshot(testDir, s2);
      saveSnapshot(testDir, s3);

      const t1 = createTransition(s1.hash, s2.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });
      const t2 = createTransition(s1.hash, s3.hash, createTestSteps(), {
        createdAt: new Date().toISOString(),
      });

      saveTransition(testDir, t1);
      saveTransition(testDir, t2);
      buildGraph(testDir);

      const reachable = getReachableSnapshots(testDir, s1.hash);
      expect(reachable).toContain(s2.hash);
      expect(reachable).toContain(s3.hash);
      expect(reachable).toHaveLength(2);
    });
  });
});
