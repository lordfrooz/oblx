import { randomBytes } from "crypto";
import type { PoolClient } from "pg";
import { MINT } from "@/lib/mint";
import { withDb } from "@/lib/db";

export const AUTO_SIM_INTERVAL_MS = 120_000;
const ACTIVITY_LIMIT = 56;

export interface SimEntry {
  id: number;
  address: string;
  amount: number;
  quantity: number;
  txHash: string;
  createdAt: string;
}

export interface SimConfig {
  inkBoost: number;
  autoEnabled: boolean;
  lastAutoAt: string | null;
}

export interface PublicActivity {
  address: string;
  amount: number;
  quantity: number;
  txHash: string;
  ago: string;
}

function formatAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "1d ago" : `${d}d ago`;
}

export function formatPercentLabel(percent: number): string {
  if (percent > 0 && percent < 0.01) return "<0.01";
  return percent.toFixed(2);
}

export function computeDisplayTotal(
  realInk: number,
  simInk: number,
  inkBoost: number,
): number {
  return Math.min(
    MINT.totalSupply,
    Math.max(0, realInk + simInk + inkBoost),
  );
}

export function randomWallet(): string {
  return `0x${randomBytes(20).toString("hex")}`;
}

export function randomTxHash(): string {
  return `0x${randomBytes(32).toString("hex")}`;
}

function pickQuantity(): number {
  const table = [1, 1, 1, 2, 2, 2, 3, 3, 4, 5, 6, 8, 10, 12, 15, 1, 2, 7];
  return table[Math.floor(Math.random() * table.length)] ?? 1;
}

async function ensureSimConfig(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS mint_sim_config (
      id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      ink_boost BIGINT NOT NULL DEFAULT 0,
      auto_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      last_auto_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS mint_sim_entries (
      id SERIAL PRIMARY KEY,
      address TEXT NOT NULL,
      amount INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      tx_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT mint_sim_tx_unique UNIQUE (tx_hash)
    );
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS mint_sim_entries_created_idx
    ON mint_sim_entries (created_at DESC);
  `);
  await client.query(`
    INSERT INTO mint_sim_config (id) VALUES (1)
    ON CONFLICT (id) DO NOTHING;
  `);
}

async function getConfig(client: PoolClient): Promise<SimConfig> {
  await ensureSimConfig(client);
  const res = await client.query<{
    ink_boost: string;
    auto_enabled: boolean;
    last_auto_at: Date | null;
  }>(`SELECT ink_boost, auto_enabled, last_auto_at FROM mint_sim_config WHERE id = 1`);
  const row = res.rows[0];
  return {
    inkBoost: Number(row?.ink_boost ?? 0),
    autoEnabled: row?.auto_enabled ?? true,
    lastAutoAt: row?.last_auto_at?.toISOString() ?? null,
  };
}

async function sumSimInk(client: PoolClient): Promise<number> {
  const res = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM mint_sim_entries`,
  );
  return Number(res.rows[0]?.total ?? 0);
}

export async function tickAutoSim(client: PoolClient): Promise<void> {
  const config = await getConfig(client);
  if (!config.autoEnabled) return;

  const last = config.lastAutoAt ? new Date(config.lastAutoAt).getTime() : 0;
  if (Date.now() - last < AUTO_SIM_INTERVAL_MS) return;

  const qty = pickQuantity();
  await client.query(
    `INSERT INTO mint_sim_entries (address, amount, quantity, tx_hash)
     VALUES ($1, $2, $3, $4)`,
    [randomWallet(), qty * MINT.amountPerMint, qty, randomTxHash()],
  );
  await client.query(
    `UPDATE mint_sim_config SET last_auto_at = NOW(), updated_at = NOW() WHERE id = 1`,
  );
}

export async function listSimEntries(client: PoolClient): Promise<SimEntry[]> {
  await ensureSimConfig(client);
  const res = await client.query<{
    id: number;
    address: string;
    amount: number;
    quantity: number;
    tx_hash: string;
    created_at: Date;
  }>(
    `SELECT id, address, amount, quantity, tx_hash, created_at
     FROM mint_sim_entries ORDER BY created_at DESC LIMIT 200`,
  );
  return res.rows.map((r) => ({
    id: r.id,
    address: r.address,
    amount: r.amount,
    quantity: r.quantity,
    txHash: r.tx_hash,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function addSimEntry(
  client: PoolClient,
  input: { quantity: number; address?: string },
): Promise<SimEntry> {
  await ensureSimConfig(client);
  const qty = Math.max(1, Math.floor(input.quantity));
  const address = input.address?.trim() || randomWallet();
  const txHash = randomTxHash();
  const res = await client.query<{
    id: number;
    address: string;
    amount: number;
    quantity: number;
    tx_hash: string;
    created_at: Date;
  }>(
    `INSERT INTO mint_sim_entries (address, amount, quantity, tx_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, address, amount, quantity, tx_hash, created_at`,
    [address, qty * MINT.amountPerMint, qty, txHash],
  );
  const r = res.rows[0]!;
  return {
    id: r.id,
    address: r.address,
    amount: r.amount,
    quantity: r.quantity,
    txHash: r.tx_hash,
    createdAt: r.created_at.toISOString(),
  };
}

export async function deleteSimEntry(client: PoolClient, id: number) {
  await client.query(`DELETE FROM mint_sim_entries WHERE id = $1`, [id]);
}

export async function setInkBoost(client: PoolClient, inkBoost: number) {
  await ensureSimConfig(client);
  const v = Math.max(0, Math.floor(inkBoost));
  await client.query(
    `UPDATE mint_sim_config SET ink_boost = $1, updated_at = NOW() WHERE id = 1`,
    [v],
  );
}

export async function setDisplayPercent(client: PoolClient, percent: number) {
  const realRes = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM mints`,
  );
  const realInk = Number(realRes.rows[0]?.total ?? 0);
  const simInk = await sumSimInk(client);
  const target = Math.min(
    MINT.totalSupply,
    Math.max(0, (percent / 100) * MINT.totalSupply),
  );
  const boost = Math.max(0, Math.floor(target - realInk - simInk));
  await setInkBoost(client, boost);
  return boost;
}

export async function setAutoEnabled(client: PoolClient, enabled: boolean) {
  await ensureSimConfig(client);
  await client.query(
    `UPDATE mint_sim_config SET auto_enabled = $1, updated_at = NOW() WHERE id = 1`,
    [enabled],
  );
}

export async function getAdminSimState(client: PoolClient) {
  await tickAutoSim(client);
  const config = await getConfig(client);
  const realRes = await client.query<{ total: string }>(
    `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM mints`,
  );
  const realInk = Number(realRes.rows[0]?.total ?? 0);
  const simInk = await sumSimInk(client);
  const displayTotal = computeDisplayTotal(realInk, simInk, config.inkBoost);
  const percent = (displayTotal / MINT.totalSupply) * 100;
  const entries = await listSimEntries(client);

  return {
    realInk,
    simInk,
    inkBoost: config.inkBoost,
    displayTotal,
    displayPercent: percent,
    displayPercentLabel: formatPercentLabel(percent),
    autoEnabled: config.autoEnabled,
    lastAutoAt: config.lastAutoAt,
    entries,
  };
}

export async function buildPublicActivity(
  client: PoolClient,
  realRows: {
    address: string;
    amount: number;
    quantity: number;
    tx_hash: string;
    created_at: Date;
  }[],
): Promise<PublicActivity[]> {
  await tickAutoSim(client);
  const simRes = await client.query<{
    address: string;
    amount: number;
    quantity: number;
    tx_hash: string;
    created_at: Date;
  }>(
    `SELECT address, amount, quantity, tx_hash, created_at
     FROM mint_sim_entries ORDER BY created_at DESC LIMIT $1`,
    [ACTIVITY_LIMIT],
  );

  const merged = [
    ...realRows.map((r) => ({
      address: r.address,
      amount: r.amount,
      quantity: r.quantity,
      txHash: r.tx_hash,
      createdAt: r.created_at.toISOString(),
    })),
    ...simRes.rows.map((r) => ({
      address: r.address,
      amount: r.amount,
      quantity: r.quantity,
      txHash: r.tx_hash,
      createdAt: r.created_at.toISOString(),
    })),
  ]
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(0, ACTIVITY_LIMIT);

  return merged.map((r) => ({
    address: r.address,
    amount: r.amount,
    quantity: r.quantity,
    txHash: r.txHash,
    ago: formatAgo(r.createdAt),
  }));
}

export async function getSimConfigForStats(client: PoolClient) {
  await ensureSimConfig(client);
  return getConfig(client);
}

export { sumSimInk, ensureSimConfig };
