import type { Model } from "./model.js";
import type { YamaEntities } from "../entities.js";
import { entitiesToModel } from "./model.js";

/**
 * Replay applied migrations to reconstruct CurrentModel
 * This is a simplified version - in a real implementation, we would:
 * 1. Load all applied migrations from the database
 * 2. Replay them in order to build up the model
 * 3. For now, we'll just return the model from entities (since we don't have migration replay yet)
 */
export function replayMigrations(
  appliedMigrations: Array<{ from_model_hash: string; to_model_hash: string }>,
  initialEntities: YamaEntities
): Model {
  // For v0, we'll use the entities directly
  // In a full implementation, we would:
  // 1. Start with an empty model
  // 2. Apply each migration's steps in order
  // 3. Track the model state after each migration
  // 4. Return the final model state

  // For now, just return the model from the current entities
  // This assumes the database matches the entities (which we'll validate with schema:check)
  return entitiesToModel(initialEntities);
}

/**
 * Get the current model hash from the database
 * This queries the _yama_migrations table to get the latest to_model_hash
 */
export async function getCurrentModelHashFromDB(
  query: (sql: string) => Promise<Array<{ to_model_hash: string }>>
): Promise<string | null> {
  try {
    const result = await query(`
      SELECT to_model_hash 
      FROM _yama_migrations 
      WHERE to_model_hash IS NOT NULL 
      ORDER BY applied_at DESC 
      LIMIT 1
    `);
    
    if (result.length > 0) {
      return result[0].to_model_hash;
    }
    return null;
  } catch {
    // Table might not exist yet
    return null;
  }
}

