import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import {
  loadState,
  saveState,
  getOrCreateState,
  updateState,
  getCurrentSnapshot,
  stateExists,
  deleteState,
  listEnvironments,
  getAllStates,
} from "./state.js";

describe("State", () => {
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

  describe("getOrCreateState", () => {
    it("should create new state if not exists", () => {
      const state = getOrCreateState(testDir, "development");
      
      expect(state.environment).toBe("development");
      expect(state.currentSnapshot).toBeNull();
      expect(state.createdAt).toBeDefined();
      expect(state.updatedAt).toBeDefined();
    });

    it("should return existing state", () => {
      const state1 = getOrCreateState(testDir, "development");
      state1.currentSnapshot = "test-hash";
      saveState(testDir, "development", state1);

      const state2 = getOrCreateState(testDir, "development");
      expect(state2.currentSnapshot).toBe("test-hash");
    });
  });

  describe("updateState", () => {
    it("should update current snapshot", () => {
      updateState(testDir, "development", "new-hash");
      
      const state = loadState(testDir, "development");
      expect(state).not.toBeNull();
      expect(state!.currentSnapshot).toBe("new-hash");
    });

    it("should update timestamp", () => {
      const state1 = getOrCreateState(testDir, "development");
      const firstUpdate = state1.updatedAt;

      // Wait a bit to ensure different timestamp
      updateState(testDir, "development", "hash1");
      const state2 = loadState(testDir, "development")!;
      
      expect(new Date(state2.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(firstUpdate).getTime()
      );
    });
  });

  describe("getCurrentSnapshot", () => {
    it("should return null for non-existent state", () => {
      const snapshot = getCurrentSnapshot(testDir, "production");
      expect(snapshot).toBeNull();
    });

    it("should return current snapshot", () => {
      updateState(testDir, "staging", "staging-hash");
      
      const snapshot = getCurrentSnapshot(testDir, "staging");
      expect(snapshot).toBe("staging-hash");
    });
  });

  describe("stateExists", () => {
    it("should return false for non-existent", () => {
      expect(stateExists(testDir, "nonexistent")).toBe(false);
    });

    it("should return true for existing", () => {
      getOrCreateState(testDir, "test");
      expect(stateExists(testDir, "test")).toBe(true);
    });
  });

  describe("deleteState", () => {
    it("should delete state", () => {
      getOrCreateState(testDir, "to-delete");
      expect(stateExists(testDir, "to-delete")).toBe(true);

      deleteState(testDir, "to-delete");
      expect(stateExists(testDir, "to-delete")).toBe(false);
    });
  });

  describe("listEnvironments", () => {
    it("should list all environments", () => {
      getOrCreateState(testDir, "development");
      getOrCreateState(testDir, "staging");
      getOrCreateState(testDir, "production");

      const envs = listEnvironments(testDir);
      expect(envs).toContain("development");
      expect(envs).toContain("staging");
      expect(envs).toContain("production");
      expect(envs).toHaveLength(3);
    });

    it("should return empty array when no environments", () => {
      const envs = listEnvironments(testDir);
      expect(envs).toHaveLength(0);
    });
  });

  describe("getAllStates", () => {
    it("should return all states", () => {
      updateState(testDir, "dev", "hash1");
      updateState(testDir, "prod", "hash2");

      const states = getAllStates(testDir);
      expect(states).toHaveLength(2);
      expect(states.find((s) => s.environment === "dev")?.currentSnapshot).toBe("hash1");
      expect(states.find((s) => s.environment === "prod")?.currentSnapshot).toBe("hash2");
    });
  });
});
