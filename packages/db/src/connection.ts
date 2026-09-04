import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

type Db = NodePgDatabase<typeof schema>;

let pool: pg.Pool | null = null;
let dbInstance: Db | null = null;

export function createPool(connectionString: string): pg.Pool {
  return new Pool({ connectionString });
}

export function createDb(connectionString: string): { db: Db; pool: pg.Pool } {
  const p = createPool(connectionString);
  const d = drizzle(p, { schema });
  return { db: d, pool: p };
}

export function getDb(connectionString?: string): Db {
  if (dbInstance) {
    return dbInstance;
  }
  const url = connectionString ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required");
  }
  const created = createDb(url);
  pool = created.pool;
  dbInstance = created.db;
  return dbInstance;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbInstance = null;
  }
}

export type Database = Db;
