import { formatEther, parseEther } from "viem";
import { base } from "viem/chains";

export const MINT = {
  tick: "oblx",
  totalSupply: 21_000_000,
  amountPerMint: 1_000,
  maxMints: 21_000,
  priceEth: "0.00015",
  /** Treasury — plain ETH transfer, no calldata (same as agentscup). */
  paymentAddress: "0x193C1c814b9d1f17CA0798269831ac38Da70909f" as const,
  chain: base,
  chainId: base.id,
  explorer: "https://basescan.org",
} as const;

export const MINT_UNIT_WEI = parseEther(MINT.priceEth);

export function mintInscriptionJson(quantity: number): string {
  return JSON.stringify({
    p: "ink-20",
    op: "mint",
    tick: MINT.tick,
    amt: String(quantity * MINT.amountPerMint),
  });
}

export function mintInkAmount(quantity: number): number {
  return quantity * MINT.amountPerMint;
}

export function mintPriceWei(quantity: number): bigint {
  return MINT_UNIT_WEI * BigInt(quantity);
}

export function mintPriceEth(quantity: number): string {
  return formatEther(mintPriceWei(quantity));
}

export function formatSupply(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatPercent(minted: number): string {
  const pct = (minted / MINT.totalSupply) * 100;
  if (pct > 0 && pct < 0.01) return "<0.01";
  return pct.toFixed(2);
}

export function maxMintQuantity(remainingInk: number): number {
  return Math.max(0, Math.floor(remainingInk / MINT.amountPerMint));
}

export function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
