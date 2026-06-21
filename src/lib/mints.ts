import { MINT } from "@/lib/mint";
import { withDb } from "@/lib/db";
import {
  buildPublicActivity,
  computeDisplayTotal,
  formatPercentLabel,
  getSimConfigForStats,
  sumSimInk,
  tickAutoSim,
} from "@/lib/mint-sim";

export interface MintActivity {
  address: string;
  amount: number;
  quantity: number;
  txHash: string;
  ago: string;
}

export interface MintStats {
  /** Display total (real + simulated) — progress bar only. */
  totalMinted: number;
  totalSupply: number;
  /** Real supply left — mint limits use this. */
  remaining: number;
  percentMinted: number;
  percentLabel: string;
  activity: MintActivity[];
}

export async function getMintStats(): Promise<MintStats> {
  return withDb(async (client) => {
    await tickAutoSim(client);

    const totalRes = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM mints`,
    );
    const realMinted = Number(totalRes.rows[0]?.total ?? 0);
    const remaining = Math.max(0, MINT.totalSupply - realMinted);

    const config = await getSimConfigForStats(client);
    const simInk = await sumSimInk(client);
    const displayTotal = computeDisplayTotal(
      realMinted,
      simInk,
      config.inkBoost,
    );
    const percentMinted = (displayTotal / MINT.totalSupply) * 100;

    const activityRes = await client.query<{
      address: string;
      amount: number;
      quantity: number;
      tx_hash: string;
      created_at: Date;
    }>(
      `SELECT address, amount, quantity, tx_hash, created_at
       FROM mints ORDER BY id DESC LIMIT 30`,
    );

    const activity = await buildPublicActivity(client, activityRes.rows);

    return {
      totalMinted: displayTotal,
      totalSupply: MINT.totalSupply,
      remaining,
      percentMinted,
      percentLabel: formatPercentLabel(percentMinted),
      activity,
    };
  });
}

export async function recordMint(input: {
  txHash: string;
  address: string;
  amount: number;
  quantity: number;
}) {
  return withDb(async (client) => {
    const totalRes = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount), 0)::bigint AS total FROM mints`,
    );
    const totalMinted = Number(totalRes.rows[0]?.total ?? 0);
    if (totalMinted + input.amount > MINT.totalSupply) {
      return { ok: false as const, error: "Supply exceeded." };
    }

    try {
      await client.query(
        `INSERT INTO mints (tx_hash, address, amount, quantity)
         VALUES ($1, $2, $3, $4)`,
        [input.txHash, input.address, input.amount, input.quantity],
      );
    } catch (e) {
      if (
        e &&
        typeof e === "object" &&
        "code" in e &&
        (e as { code: string }).code === "23505"
      ) {
        return { ok: true as const, duplicate: true };
      }
      throw e;
    }

    return { ok: true as const, duplicate: false };
  });
}
