/** Base mainnet JSON-RPC — server-side (mint verification, APIs). */
export function getBaseRpcUrl(): string {
  const url = process.env.BASE_RPC_URL?.trim();
  if (!url) {
    throw new Error("BASE_RPC_URL is not configured");
  }
  return url;
}

/** Base mainnet JSON-RPC — client-side (wagmi / wallet). */
export function getPublicBaseRpcUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim() ??
    process.env.BASE_RPC_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_BASE_RPC_URL is not configured");
  }
  return url;
}

export const BASE_CAIP_NETWORK_ID = "eip155:8453" as const;
