import type { DatabaseConfig } from "@yama/core";
import { initDatabase, getSQL, closeDatabase } from "./client.js";

/**
 * Create a data snapshot before destructive operations
 * This creates a backup table with the current data
 */
export async function createDataSnapshot(
  tableName: string,
  config: DatabaseConfig,
  snapshotName?: string
): Promise<{ snapshotTable: string; rowCount: number }> {
  const timestamp = Date.now();
  const name = snapshotName || `${tableName}_snapshot_${timestamp}`;
  
  initDatabase(config);
  const sql = getSQL();

  try {
    // Create snapshot table with data
    await sql.unsafe(`
      CREATE TABLE ${name} AS 
      SELECT * FROM ${tableName}
    `);

    // Get row count
    const result = await sql.unsafe(`SELECT COUNT(*) as count FROM ${name}`);
    const rowCount = Number((result[0] as unknown as { count: bigint }).count);

    // Add metadata
    await sql.unsafe(`
      COMMENT ON TABLE ${name} IS 'Snapshot of ${tableName} created at ${new Date().toISOString()}'
    `);

    return {
      snapshotTable: name,
      rowCount,
    };
  } finally {
    await closeDatabase();
  }
}

/**
 * Restore data from snapshot
 */
export async function restoreFromSnapshot(
  snapshotTable: string,
  targetTable: string,
  config: DatabaseConfig
): Promise<void> {
  initDatabase(config);
  const sql = getSQL();

  try {
    // Check if snapshot exists
    const check = await sql.unsafe(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = '${snapshotTable}'
      ) as exists
    `);
    
    if (!(check[0] as unknown as { exists: boolean }).exists) {
      throw new Error(`Snapshot table ${snapshotTable} does not exist`);
    }

    // Restore data (truncate and insert)
    await sql.begin(async (tx) => {
      await tx.unsafe(`TRUNCATE TABLE ${targetTable}`);
      await tx.unsafe(`INSERT INTO ${targetTable} SELECT * FROM ${snapshotTable}`);
    });
  } finally {
    await closeDatabase();
  }
}

/**
 * Delete snapshot table
 */
export async function deleteSnapshot(
  snapshotTable: string,
  config: DatabaseConfig
): Promise<void> {
  initDatabase(config);
  const sql = getSQL();

  try {
    await sql.unsafe(`DROP TABLE IF EXISTS ${snapshotTable}`);
  } finally {
    await closeDatabase();
  }
}

/**
 * List all snapshots
 */
export async function listSnapshots(config: DatabaseConfig): Promise<Array<{
  table_name: string;
  created_at: string;
  row_count: number;
}>> {
  initDatabase(config);
  const sql = getSQL();

  try {
    const result = await sql.unsafe(`
      SELECT 
        table_name,
        obj_description(c.oid) as comment
      FROM information_schema.tables t
      JOIN pg_class c ON c.relname = t.table_name
      WHERE table_name LIKE '%_snapshot_%'
      ORDER BY table_name
    `);

    // Parse snapshots from result
    const snapshots: Array<{
      table_name: string;
      created_at: string;
      row_count: number;
    }> = [];
    for (const row of result as unknown as Array<{ table_name: string; comment: string | null }>) {
      const rowCountResult = await sql.unsafe(`SELECT COUNT(*) as count FROM ${row.table_name}`);
      const rowCount = Number((rowCountResult[0] as unknown as { count: bigint }).count);

      snapshots.push({
        table_name: row.table_name,
        created_at: row.comment || "unknown",
        row_count: rowCount,
      });
    }

    return snapshots;
  } finally {
    await closeDatabase();
  }
}

