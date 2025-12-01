import type { Model } from "./model.js";
import type { YamaEntities } from "../entities.js";
/**
 * Replay applied migrations to reconstruct CurrentModel
 * This is a simplified version - in a real implementation, we would:
 * 1. Load all applied migrations from the database
 * 2. Replay them in order to build up the model
 * 3. For now, we'll just return the model from entities (since we don't have migration replay yet)
 */
export declare function replayMigrations(appliedMigrations: Array<{
    from_model_hash: string;
    to_model_hash: string;
}>, initialEntities: YamaEntities): Model;
/**
 * Get the current model hash from the database
 * This queries the _yama_migrations table to get the latest to_model_hash
 */
export declare function getCurrentModelHashFromDB(query: (sql: string) => Promise<Array<{
    to_model_hash: string;
}>>): Promise<string | null>;
