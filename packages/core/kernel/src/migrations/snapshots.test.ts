import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  createSnapshot,
  saveSnapshot,
  loadSnapshot,
  snapshotExists,
  getAllSnapshots,
  getAllSnapshotHashes,
  deleteSnapshot,
} from "./snapshots.js";
import type { YamaEntities } from "../entities.js";

describe("Snapshots", () => {
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

  const testEntities: YamaEntities = {
    User: {
      table: "users",
      fields: {
        id: { type: "uuid", primary: true, generated: true },
        name: { type: "string", required: true },
        email: { type: "string", required: true },
      },
    },
    Post: {
      table: "posts",
      fields: {
        id: { type: "uuid", primary: true, generated: true },
        title: { type: "string", required: true },
        authorId: { type: "uuid", required: true },
      },
    },
  };

  describe("createSnapshot", () => {
    it("should create a snapshot with hash", () => {
      const snapshot = createSnapshot(testEntities, {
        createdAt: new Date().toISOString(),
        createdBy: "test",
        description: "Test snapshot",
      });

      expect(snapshot.hash).toBeDefined();
      expect(snapshot.hash).toHaveLength(64);
      expect(snapshot.entities).toEqual(testEntities);
      expect(snapshot.metadata.description).toBe("Test snapshot");
    });

    it("should generate same hash for same entities", () => {
      const snapshot1 = createSnapshot(testEntities, {
        createdAt: "2024-01-01",
        createdBy: "test",
      });
      const snapshot2 = createSnapshot(testEntities, {
        createdAt: "2024-01-02",
        createdBy: "test2",
      });

      expect(snapshot1.hash).toBe(snapshot2.hash);
    });

    it("should generate different hash for different entities", () => {
      const modifiedEntities = {
        ...testEntities,
        User: {
          ...testEntities.User,
          fields: {
            ...testEntities.User.fields,
            newField: { type: "string" },
          },
        },
      };

      const snapshot1 = createSnapshot(testEntities, {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });
      const snapshot2 = createSnapshot(modifiedEntities, {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      expect(snapshot1.hash).not.toBe(snapshot2.hash);
    });

    it("should include parent hash", () => {
      const snapshot = createSnapshot(
        testEntities,
        { createdAt: new Date().toISOString(), createdBy: "test" },
        "parent-hash-123"
      );

      expect(snapshot.parentHash).toBe("parent-hash-123");
    });
  });

  describe("saveSnapshot and loadSnapshot", () => {
    it("should save and load snapshot", () => {
      const snapshot = createSnapshot(testEntities, {
        createdAt: new Date().toISOString(),
        createdBy: "test",
        description: "Test",
      });

      saveSnapshot(testDir, snapshot);
      expect(snapshotExists(testDir, snapshot.hash)).toBe(true);

      const loaded = loadSnapshot(testDir, snapshot.hash);
      expect(loaded).toBeDefined();
      expect(loaded!.hash).toBe(snapshot.hash);
      expect(loaded!.entities).toEqual(testEntities);
    });

    it("should return null for non-existent snapshot", () => {
      const loaded = loadSnapshot(testDir, "non-existent-hash");
      expect(loaded).toBeNull();
    });
  });

  describe("getAllSnapshots", () => {
    it("should return all snapshots", () => {
      const snapshot1 = createSnapshot(testEntities, {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      const modifiedEntities = {
        ...testEntities,
        NewEntity: {
          table: "new_table",
          fields: { id: { type: "uuid" } },
        },
      };
      const snapshot2 = createSnapshot(modifiedEntities, {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, snapshot1);
      saveSnapshot(testDir, snapshot2);

      const all = getAllSnapshots(testDir);
      expect(all).toHaveLength(2);
      expect(all.map((s) => s.hash)).toContain(snapshot1.hash);
      expect(all.map((s) => s.hash)).toContain(snapshot2.hash);
    });

    it("should return empty array when no snapshots", () => {
      const all = getAllSnapshots(testDir);
      expect(all).toHaveLength(0);
    });
  });

  describe("deleteSnapshot", () => {
    it("should delete snapshot", () => {
      const snapshot = createSnapshot(testEntities, {
        createdAt: new Date().toISOString(),
        createdBy: "test",
      });

      saveSnapshot(testDir, snapshot);
      expect(snapshotExists(testDir, snapshot.hash)).toBe(true);

      deleteSnapshot(testDir, snapshot.hash);
      expect(snapshotExists(testDir, snapshot.hash)).toBe(false);
    });
  });
});
