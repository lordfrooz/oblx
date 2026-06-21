/** Normalize wallet / RPC rejections into a readable Error. */
export function formatWalletError(err: unknown): string {
  if (typeof err === "string") return err;

  if (err instanceof Error) {
    const withShort = err as Error & { shortMessage?: string };
    if (withShort.shortMessage) return withShort.shortMessage;
    const first = err.message.split("\n")[0]?.trim();
    if (first) return first;
  }

  if (err && typeof err === "object") {
    const o = err as {
      shortMessage?: string;
      message?: string;
      details?: string;
      code?: number;
      data?: { message?: string };
    };

    if (o.shortMessage) return o.shortMessage;
    if (typeof o.message === "string" && o.message.trim()) {
      return o.message.split("\n")[0].trim();
    }
    if (o.details) return o.details;
    if (o.data?.message) return o.data.message;

    if (o.code === 4001) return "Transaction cancelled.";
  }

  return "Transaction failed. Check Base network, ETH balance, and try again.";
}

export function isUserRejection(err: unknown): boolean {
  const msg = formatWalletError(err).toLowerCase();
  return /user rejected|denied|cancelled|canceled|rejected the request/.test(
    msg,
  );
}
