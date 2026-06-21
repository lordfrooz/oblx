import {
  createPublicClient,
  getAddress,
  http,
  isAddressEqual,
  type Hash,
} from "viem";
import { MINT, MINT_UNIT_WEI, mintPriceWei } from "@/lib/mint";
import { getBaseRpcUrl } from "@/lib/rpc";

const client = createPublicClient({
  chain: MINT.chain,
  transport: http(getBaseRpcUrl()),
});

export interface VerifiedMint {
  address: string;
  amount: number;
  quantity: number;
  txHash: string;
}

/** Verify plain ETH payment to treasury (agentscup-style — no calldata). */
export async function verifyMintTx(
  txHash: string,
): Promise<VerifiedMint | null> {
  let hash: Hash;
  try {
    hash = txHash as Hash;
  } catch {
    return null;
  }

  const [tx, receipt] = await Promise.all([
    client.getTransaction({ hash }),
    client.getTransactionReceipt({ hash }),
  ]);

  if (!tx || !receipt || receipt.status !== "success") return null;
  if (!tx.to || !isAddressEqual(getAddress(tx.to), getAddress(MINT.paymentAddress))) {
    return null;
  }
  if (tx.value < MINT_UNIT_WEI || tx.value % MINT_UNIT_WEI !== BigInt(0)) {
    return null;
  }

  const quantity = Number(tx.value / MINT_UNIT_WEI);
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  if (tx.value !== mintPriceWei(quantity)) return null;

  return {
    address: tx.from.toLowerCase(),
    amount: quantity * MINT.amountPerMint,
    quantity,
    txHash: hash,
  };
}
