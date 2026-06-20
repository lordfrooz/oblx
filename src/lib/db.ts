import { Pool, type PoolClient, type QueryResultRow } from "pg";

const globalForPg = globalThis as typeof globalThis & { pgPool?: Pool };

function pool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  if (!globalForPg.pgPool) {
    globalForPg.pgPool = new Pool({
      connectionString: url,
      max: 5,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalForPg.pgPool;
}

let schemaReady: Promise<void> | null = null;

async function ensureSchema(client: PoolClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS claims (
      id SERIAL PRIMARY KEY,
      handle TEXT NOT NULL,
      address TEXT NOT NULL,
      invite_used TEXT,
      code TEXT NOT NULL,
      position INTEGER NOT NULL,
      quests JSONB NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT claims_handle_unique UNIQUE (handle),
      CONSTRAINT claims_address_unique UNIQUE (address),
      CONSTRAINT claims_code_unique UNIQUE (code)
    );
  `);
}

export async function withDb<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    if (!schemaReady) {
      schemaReady = ensureSchema(client);
    }
    await schemaReady;
    return await fn(client);
  } finally {
    client.release();
  }
}

export interface ClaimRow extends QueryResultRow {
  id: number;
  handle: string;
  address: string;
  invite_used: string | null;
  code: string;
  position: number;
  quests: Record<string, boolean>;
  created_at: Date;
}
