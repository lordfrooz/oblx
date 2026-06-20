import type { PoolClient } from "pg";
import { withDb, type ClaimRow } from "@/lib/db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function hash32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Deterministic invite code from a seed -> OBLX-XXXX-XXXX */
export function inviteCode(seed: string): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    const h = hash32(`${seed}#${i}`);
    out += ALPHABET[h % ALPHABET.length];
    if (i === 3) out += "-";
  }
  return `OBLX-${out}`;
}

export function normalizeHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

export function normalizeAddress(raw: string): string {
  return raw.trim().toLowerCase();
}

function rowToClaim(row: ClaimRow) {
  return {
    handle: row.handle,
    address: row.address,
    code: row.code,
    position: row.position,
    invite: row.invite_used,
    quests: row.quests,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findByHandle(handle: string) {
  const normalized = normalizeHandle(handle);
  return withDb(async (client) => {
    const { rows } = await client.query<ClaimRow>(
      `SELECT * FROM claims WHERE handle = $1 LIMIT 1`,
      [normalized],
    );
    return rows[0] ? rowToClaim(rows[0]) : null;
  });
}

export async function findByAddress(address: string) {
  const normalized = normalizeAddress(address);
  return withDb(async (client) => {
    const { rows } = await client.query<ClaimRow>(
      `SELECT * FROM claims WHERE address = $1 LIMIT 1`,
      [normalized],
    );
    return rows[0] ? rowToClaim(rows[0]) : null;
  });
}

export async function findByCode(code: string) {
  const normalized = code.trim().toUpperCase();
  return withDb(async (client) => {
    const { rows } = await client.query<ClaimRow>(
      `SELECT * FROM claims WHERE code = $1 LIMIT 1`,
      [normalized],
    );
    return rows[0] ? rowToClaim(rows[0]) : null;
  });
}

export async function createClaim(input: {
  handle: string;
  address: string;
  invite?: string | null;
  quests: Record<string, boolean>;
}) {
  const handle = normalizeHandle(input.handle);
  const address = normalizeAddress(input.address);
  const code = inviteCode(`${address}:${handle}`);

  return withDb(async (client) => {
    const existingHandle = await client.query<ClaimRow>(
      `SELECT * FROM claims WHERE handle = $1 LIMIT 1`,
      [handle],
    );
    if (existingHandle.rows[0]) {
      return {
        kind: "returning" as const,
        claim: rowToClaim(existingHandle.rows[0]),
      };
    }

    const existingAddress = await client.query<ClaimRow>(
      `SELECT * FROM claims WHERE address = $1 LIMIT 1`,
      [address],
    );
    if (existingAddress.rows[0]) {
      return {
        kind: "address_taken" as const,
        claim: rowToClaim(existingAddress.rows[0]),
      };
    }

    const position = await nextPosition(client);
    const { rows } = await client.query<ClaimRow>(
      `INSERT INTO claims (handle, address, invite_used, code, position, quests)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        handle,
        address,
        input.invite?.trim() || null,
        code,
        position,
        JSON.stringify(input.quests),
      ],
    );

    return {
      kind: "created" as const,
      claim: rowToClaim(rows[0]),
    };
  });
}

async function nextPosition(client: PoolClient): Promise<number> {
  const { rows } = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(position), 0) + 1 AS next FROM claims`,
  );
  return rows[0]?.next ?? 1;
}
