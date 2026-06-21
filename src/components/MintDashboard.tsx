"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAppKit } from "@reown/appkit/react";
import {
  useConnection,
  useDisconnect,
  useSendTransaction,
  useSwitchChain,
  useWaitForTransactionReceipt,
} from "wagmi";
import { formatWalletError, isUserRejection } from "@/lib/wallet-error";
import {
  MINT,
  formatSupply,
  maxMintQuantity,
  mintInscriptionJson,
  mintInkAmount,
  mintPriceEth,
  mintPriceWei,
  truncateAddress,
} from "@/lib/mint";
import { Mark } from "@/components/Mark";

interface MintStats {
  totalMinted: number;
  totalSupply: number;
  remaining: number;
  percentMinted: number;
  percentLabel: string;
  activity: {
    address: string;
    amount: number;
    quantity: number;
    txHash: string;
    ago: string;
  }[];
}

function clampQty(raw: number, max: number): number {
  if (max < 1) return 1;
  return Math.max(1, Math.min(max, Math.floor(raw) || 1));
}

function MintProgressBar({
  className,
  percent,
  percentLabel,
  totalMinted,
}: {
  className?: string;
  percent: number;
  percentLabel: string;
  totalMinted: number;
}) {
  return (
    <div className={className}>
      <div className="mint-progress-meta">
        <span className="mint-progress-meta-label">{percentLabel}% minted</span>
        <span className="mint-progress-meta-value">
          {formatSupply(totalMinted)} / {formatSupply(MINT.totalSupply)}
        </span>
      </div>
      <div
        className="mint-progress-wrap"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Mint progress"
      >
        <div
          className="mint-progress-fill"
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
    </div>
  );
}

export default function MintDashboard() {
  const { open } = useAppKit();
  const { address, isConnected, isConnecting, chainId } = useConnection();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const {
    sendTransactionAsync,
    isPending: isSendPending,
    reset: resetSend,
  } = useSendTransaction();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [sendError, setSendError] = useState<string | null>(null);
  const pendingMintRef = useRef(false);

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const [qtyInput, setQtyInput] = useState("1");
  const [stats, setStats] = useState<MintStats | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const recordedRef = useRef<string | null>(null);

  const wrongChain = isConnected && chainId !== MINT.chainId;
  const busy =
    isConnecting || isSendPending || isConfirming || isSwitching;

  const maxQty = stats ? maxMintQuantity(stats.remaining) : MINT.maxMints;
  const soldOut = stats !== null && stats.remaining <= 0;
  const parsedQty = parseInt(qtyInput, 10);
  const mintQty = clampQty(Number.isNaN(parsedQty) ? 1 : parsedQty, maxQty);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/mints");
      const data = (await res.json()) as MintStats & { ok?: boolean };
      if (res.ok && data.ok !== false) {
        const { ok: _ok, ...rest } = data;
        void _ok;
        setStats(rest);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refreshStats();
    const id = setInterval(() => void refreshStats(), 20_000);
    return () => clearInterval(id);
  }, [refreshStats]);

  useEffect(() => {
    if (!isSuccess || !txHash) return;
    if (recordedRef.current === txHash) return;
    recordedRef.current = txHash;
    void (async () => {
      await fetch("/api/mints/record", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ txHash }),
      });
      await refreshStats();
    })();
  }, [isSuccess, txHash, refreshStats]);

  function commitQtyInput() {
    setQtyInput(String(mintQty));
  }

  function onQtyChange(value: string) {
    const digits = value.replace(/\D/g, "");
    setQtyInput(digits === "" ? "" : digits.replace(/^0+(?=\d)/, ""));
  }

  function stepQty(delta: number) {
    const next = clampQty(mintQty + delta, maxQty);
    setQtyInput(String(next));
  }

  const executeMint = useCallback(async () => {
    if (!address) return;

    const qty = clampQty(parseInt(qtyInput, 10) || 1, maxQty);
    setQtyInput(String(qty));
    setSendError(null);
    setTxHash(undefined);
    recordedRef.current = null;
    resetSend();

    try {
      const hash = await sendTransactionAsync({
        to: MINT.paymentAddress,
        value: mintPriceWei(qty),
        chainId: MINT.chainId,
      });
      setTxHash(hash);
    } catch (err) {
      setSendError(
        isUserRejection(err) ? "Transaction cancelled." : formatWalletError(err),
      );
    }
  }, [address, maxQty, qtyInput, resetSend, sendTransactionAsync]);

  useEffect(() => {
    if (!pendingMintRef.current || !isConnected || !address) return;
    if (chainId !== MINT.chainId) return;
    pendingMintRef.current = false;
    void executeMint();
  }, [isConnected, address, chainId, executeMint]);

  async function onMint() {
    setLocalError(null);
    setSendError(null);
    if (soldOut) return;

    if (!isConnected || !address) {
      pendingMintRef.current = true;
      open();
      return;
    }
    if (wrongChain) {
      switchChain({ chainId: MINT.chainId });
      return;
    }
    if (maxQty < 1) {
      setLocalError("Supply exhausted.");
      return;
    }

    await executeMint();
  }

  const errorMsg = localError ?? sendError;

  const percent = stats?.percentMinted ?? 0;
  const displayTotal = stats?.totalMinted ?? 0;
  const percentLabel = stats?.percentLabel ?? "0.00";
  const activity = stats?.activity ?? [];
  const activityCount = activity.length;

  function mintButtonLabel(): string {
    if (soldOut) return "Sold out";
    if (!isConnected) return "Connect wallet";
    if (wrongChain) return "Switch to Base";
    if (busy) {
      if (isConfirming) return "Confirming…";
      if (isSendPending) return "Submitting…";
      return "Processing…";
    }
    return `Mint · ${mintPriceEth(mintQty)} ETH`;
  }

  return (
    <div className="mint-shell">
      <nav className="mint-nav">
        <Link href="/mint" className="mint-brand">
          <div className="mint-brand-logo" aria-hidden>
            <Mark size={34} />
          </div>
          <div className="mint-brand-text">
            <span className="mint-brand-name">OBLX.INK</span>
            <span className="mint-brand-tag">INK-20 · Base</span>
          </div>
        </Link>

        <div className="mint-nav-right">
          <span className="mint-badge">
            <span className="mint-badge-dot" aria-hidden />
            Base Mainnet
          </span>

          {isConnected && address ? (
            <>
              <span className="mint-wallet-chip">{truncateAddress(address)}</span>
              <button
                type="button"
                className="mint-btn-ghost"
                onClick={() => disconnect()}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              className="mint-btn-primary"
              disabled={busy}
              onClick={() => open()}
            >
              Connect wallet
            </button>
          )}
        </div>
      </nav>

      <section className="mint-hero">
        <div className="mint-hero-card">
          <div className="mint-showcase">
            <div className="mint-logo-stage">
              <div className="mint-logo-glow" aria-hidden />
              <Mark size={120} priority className="mint-logo-mark" />
            </div>

            <div className="mint-showcase-body">
              <p className="mint-showcase-kicker">You are minting</p>
              <div className="mint-showcase-title-row">
                <h1 className="mint-hero-title">{MINT.tick.toUpperCase()}</h1>
                <span className="mint-tick-pill">{MINT.tick.toUpperCase()}</span>
              </div>
              <p className="mint-hero-sub">
                INK-20 on Base. Pay ETH to treasury — allocation tracked on-chain
                by payment. {formatSupply(MINT.amountPerMint)} tokens per unit
                at {MINT.priceEth} ETH.
              </p>
            </div>

            <div className="mint-hero-pct">
              <div className="mint-hero-pct-value">
                {percentLabel}
                <span className="mint-hero-pct-suffix">%</span>
              </div>
              <p className="mint-hero-pct-label">Minted</p>
            </div>
          </div>

          <div className="mint-stats-row">
            <div className="mint-stat">
              <p className="mint-stat-label">Total supply</p>
              <p className="mint-stat-value">
                {formatSupply(MINT.totalSupply)}{" "}
                <span>{MINT.tick.toUpperCase()}</span>
              </p>
            </div>
            <div className="mint-stat">
              <p className="mint-stat-label">Minted</p>
              <p className="mint-stat-value">
                {formatSupply(displayTotal)}
              </p>
            </div>
            <div className="mint-stat">
              <p className="mint-stat-label">Remaining</p>
              <p className="mint-stat-value">
                {formatSupply(Math.max(0, MINT.totalSupply - displayTotal))}
              </p>
            </div>
          </div>

          <MintProgressBar
            percent={percent}
            percentLabel={percentLabel}
            totalMinted={displayTotal}
          />
        </div>
      </section>

      <div className="mint-main">
        <div className="mint-card">
          <div className="mint-card-head">
            <div className="mint-card-head-inner">
              <div className="mint-card-logo" aria-hidden>
                <Mark size={30} />
              </div>
              <div>
                <h2 className="mint-card-title">Mint terminal</h2>
                <p className="mint-card-desc">
                  Enter the number of units to inscribe.
                </p>
              </div>
            </div>
          </div>

          <div className="mint-card-body">
            <MintProgressBar
              className="mint-progress-block is-compact"
              percent={percent}
              percentLabel={percentLabel}
              totalMinted={displayTotal}
            />

            <label className="mint-field-label" htmlFor="mint-qty">
              Units
            </label>
            <div className="mint-qty-row">
              <button
                type="button"
                className="mint-qty-btn"
                disabled={mintQty <= 1 || soldOut}
                onClick={() => stepQty(-1)}
                aria-label="Decrease units"
              >
                −
              </button>
              <input
                id="mint-qty"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                className="mint-qty-input"
                value={qtyInput}
                disabled={soldOut}
                onChange={(e) => onQtyChange(e.target.value)}
                onBlur={commitQtyInput}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    commitQtyInput();
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                aria-label="Mint units"
              />
              <button
                type="button"
                className="mint-qty-btn"
                disabled={mintQty >= maxQty || soldOut || maxQty < 1}
                onClick={() => stepQty(1)}
                aria-label="Increase units"
              >
                +
              </button>
            </div>
            <p className="mint-qty-hint">
              1 unit = {formatSupply(MINT.amountPerMint)} {MINT.tick.toUpperCase()}{" "}
              · {MINT.priceEth} ETH each
              {stats && maxQty > 0 && (
                <> · {formatSupply(maxQty)} units left</>
              )}
            </p>

            <div className="mint-summary">
              <div className="mint-summary-row">
                <span className="mint-summary-label">You receive</span>
                <span className="mint-summary-value">
                  {formatSupply(mintInkAmount(mintQty))}{" "}
                  {MINT.tick.toUpperCase()}
                </span>
              </div>
              <div className="mint-summary-row">
                <span className="mint-summary-label">Unit price</span>
                <span className="mint-summary-value">{MINT.priceEth} ETH</span>
              </div>
              <div className="mint-summary-row">
                <span className="mint-summary-label">Network</span>
                <span className="mint-summary-value">Base</span>
              </div>
              <div className="mint-summary-row is-total">
                <span className="mint-summary-label">Total cost</span>
                <span className="mint-summary-value">
                  {mintPriceEth(mintQty)} ETH
                </span>
              </div>
            </div>

            <div className="mint-inscription">
              <p className="mint-inscription-label">Mint allocation</p>
              <p className="mint-inscription-json">
                {mintInscriptionJson(mintQty)}
              </p>
            </div>

            {isSuccess && txHash && (
              <p className="mint-feedback is-success">
                Transaction confirmed.{" "}
                <a
                  href={`${MINT.explorer}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on BaseScan
                </a>
              </p>
            )}

            {errorMsg && (
              <p className="mint-feedback is-error">{errorMsg}</p>
            )}

            <div className="mint-card-actions">
              <button
                type="button"
                className="mint-btn-primary is-wide"
                disabled={busy || soldOut}
                onClick={() => void onMint()}
              >
                {mintButtonLabel()}
              </button>
            </div>
          </div>
        </div>

        <div className="mint-activity-card">
          <div className="mint-activity-head">
            <h2 className="mint-activity-title">Recent mints</h2>
            {activityCount > 0 && (
              <span className="mint-activity-count">{activityCount} recent</span>
            )}
          </div>

          {activityCount > 0 ? (
            <>
              <div className="mint-table-head">
                <span>Wallet</span>
                <span>Amount</span>
                <span>Tx</span>
              </div>
              <div className="mint-table-body">
                {activity.map((item) => (
                  <div key={item.txHash} className="mint-table-row">
                    <a
                      href={`${MINT.explorer}/address/${item.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mint-table-wallet is-link"
                    >
                      {truncateAddress(item.address)}
                    </a>
                    <span className="mint-table-amt">
                      {formatSupply(item.amount)}
                      {item.quantity > 1 ? ` · ${item.quantity}×` : ""}
                    </span>
                    <a
                      href={`${MINT.explorer}/tx/${item.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mint-table-tx"
                      title={item.ago}
                    >
                      {item.ago} ↗
                    </a>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="mint-table-empty">
              <p>No mints yet</p>
              <span>Activity will appear here after the first inscription.</span>
            </div>
          )}
        </div>
      </div>

      <footer className="mint-footer">
        OBLX.INK · INK-20 · Base · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
