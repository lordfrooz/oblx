"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { isAddress } from "viem";
import { Mark } from "@/components/Mark";
import { QUESTS, SITE, type QuestId } from "@/lib/config";
import { clearRitual, loadRitual, saveRitual } from "@/lib/ritual-storage";

type Step = "intro" | "handle" | "quests" | "wallet" | "done";

const STEP_ORDER: Step[] = ["intro", "handle", "quests", "wallet", "done"];

const fade = {
  initial: { opacity: 0, y: 18, filter: "blur(8px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -18, filter: "blur(8px)" },
  transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const },
};

function cleanHandle(raw: string) {
  return raw.trim().replace(/^@+/, "");
}
function validHandle(h: string) {
  return /^[A-Za-z0-9_]{1,15}$/.test(cleanHandle(h));
}

const EMPTY_QUESTS: Record<QuestId, boolean> = {
  follow: false,
  reply: false,
  qrt: false,
  like: false,
};

function readSavedProgress() {
  const saved = loadRitual();
  if (!saved || saved.step === "intro" || saved.step === "done") return null;
  return saved;
}

export default function EarlyAccess({ open }: { open: boolean }) {
  const [step, setStep] = useState<Step>("intro");
  const [handle, setHandle] = useState("");
  const [done, setDone] = useState<Record<QuestId, boolean>>(EMPTY_QUESTS);
  const [address, setAddress] = useState("");
  const [invite, setInvite] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [addressCheck, setAddressCheck] = useState({
    forAddr: "",
    taken: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleOk = validHandle(handle);
  const allQuestsDone = QUESTS.every((q) => done[q.id]);
  const addressOk = useMemo(() => isAddress(address.trim()), [address]);
  const addressTaken =
    addressOk &&
    addressCheck.forAddr === address.trim().toLowerCase() &&
    addressCheck.taken;

  const stepIndex = STEP_ORDER.indexOf(step);

  useEffect(() => {
    const saved = readSavedProgress();
    if (!saved) return;
    if (!open && saved.step !== "handle") return;
    const id = requestAnimationFrame(() => {
      setStep(saved.step);
      setHandle(saved.handle);
      setDone(saved.done);
      setAddress(saved.address);
      setInvite(saved.invite);
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (step === "intro") {
      clearRitual();
      return;
    }
    if (step === "done") return;
    saveRitual({ step, handle, done, address, invite });
  }, [step, handle, done, address, invite]);

  useEffect(() => {
    if (!addressOk) return;
    const addr = address.trim().toLowerCase();
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/claim?address=${encodeURIComponent(addr)}`);
        const data = (await res.json()) as { found?: boolean };
        if (!cancelled) {
          setAddressCheck({ forAddr: addr, taken: data.found === true });
        }
      } catch {
        if (!cancelled) setAddressCheck({ forAddr: addr, taken: false });
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [address, addressOk]);

  function openQuest(id: QuestId, href: string) {
    window.open(href, "_blank", "noopener,noreferrer");
    setDone((d) => ({ ...d, [id]: true }));
  }

  async function continueFromHandle() {
    if (!handleOk) return;
    setError(null);
    setChecking(true);
    try {
      const res = await fetch(
        `/api/claim?handle=${encodeURIComponent(cleanHandle(handle))}`,
      );
      const data = (await res.json()) as {
        ok: boolean;
        found?: boolean;
        code?: string;
        position?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }
      if (data.found) {
        clearRitual();
        setCode(data.code ?? null);
        setPosition(data.position ?? null);
        setStep("done");
        return;
      }
      if (!open) {
        setError("Registrations are closed.");
        return;
      }
      setStep("quests");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setChecking(false);
    }
  }

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle: cleanHandle(handle),
          address: address.trim(),
          invite: invite.trim() || null,
          quests: done,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        code?: string;
        position?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }
      setCode(data.code ?? null);
      setPosition(data.position ?? null);
      clearRitual();
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="relative z-10 flex min-h-screen flex-col">
      {/* top bar */}
      <header className="flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-3">
          <Mark size={30} />
          <span className="mono text-xs tracking-[0.35em] text-ink-dim">
            OBLX.INK
          </span>
        </div>
        <a
          href={`https://x.com/${SITE.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-[0.66rem] uppercase tracking-[0.3em] text-ink-dim transition-colors hover:text-ink-white"
        >
          @{SITE.handle}
        </a>
      </header>

      {/* progress rail */}
      {step !== "intro" && (
        <div className="px-6 md:px-12">
          <div className="mx-auto flex w-full max-w-xl items-center gap-2">
            {STEP_ORDER.slice(1).map((s, i) => {
              const idx = i + 1;
              const active = idx <= stepIndex;
              return (
                <div key={s} className="flex-1">
                  <div
                    className="h-px w-full transition-colors duration-700"
                    style={{
                      background: active
                        ? "var(--ink-white)"
                        : "var(--ink-line)",
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* body */}
      <section className="flex flex-1 items-center justify-center px-6 py-10 md:px-12">
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait">
            {step === "intro" && (
              <motion.div key="intro" {...fade} className="text-center">
                <div className="mb-10 flex justify-center">
                  <div className="ink-rise breathe">
                    <Mark size={150} priority />
                  </div>
                </div>
                <p className="kicker mb-6 text-ink-dim">
                  Ink & inscriptions on {SITE.chain} · Early Access
                </p>
                <h1 className="display mb-6 text-5xl md:text-7xl">
                  The ink
                  <br />
                  remembers.
                </h1>
                <p className="mx-auto mb-12 max-w-md text-sm leading-relaxed text-ink-dim">
                  {open
                    ? "A limited circle is being inked before the gates open. Complete the ritual to inscribe your place — and an invite code to share."
                    : "The circle is sealed. New inscriptions are closed for now."}
                </p>
                {open ? (
                  <button
                    className="ink-btn"
                    onClick={() => setStep("handle")}
                  >
                    Begin the ritual
                  </button>
                ) : (
                  <button
                    className="ink-btn"
                    onClick={() => setStep("handle")}
                  >
                    Already inscribed?
                  </button>
                )}
              </motion.div>
            )}

            {step === "handle" && (
              <motion.div key="handle" {...fade}>
                <StepHeader index={1} title="Who are you?" />
                <p className="mb-10 text-sm leading-relaxed text-ink-dim">
                  {open
                    ? "Enter your X handle. This is how the circle will know you."
                    : "Enter your X handle to retrieve your invite code."}
                </p>
                <div className="flex items-center gap-3">
                  <span className="flex shrink-0 items-center text-ink-dim">
                    <XLogo size={22} />
                  </span>
                  <span className="text-2xl text-ink-faint">@</span>
                  <input
                    autoFocus
                    className="ink-input"
                    placeholder="yourusername"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && handleOk && !checking) {
                        void continueFromHandle();
                      }
                    }}
                    spellCheck={false}
                    autoCapitalize="none"
                  />
                </div>
                <div className="mt-3 h-4">
                  {handle.length > 0 && !handleOk && (
                    <span className="mono text-xs text-ink-danger">
                      That doesn&apos;t look like a valid handle.
                    </span>
                  )}
                </div>
                {error && step === "handle" && (
                  <p className="mono mt-4 text-xs text-ink-danger">{error}</p>
                )}
                <div className="mt-10 flex items-center justify-between">
                  <BackBtn onClick={() => setStep("intro")} />
                  <button
                    className="ink-btn"
                    disabled={!handleOk || checking}
                    onClick={() => void continueFromHandle()}
                  >
                    {checking ? "Checking…" : "Continue"}
                  </button>
                </div>
              </motion.div>
            )}

            {step === "quests" && (
              <motion.div key="quests" {...fade}>
                <StepHeader index={2} title="Perform the ritual." />
                <p className="mb-8 text-sm leading-relaxed text-ink-dim">
                  Four marks. Each opens X — return here once it&apos;s done.
                </p>
                <div className="flex flex-col">
                  {QUESTS.map((q, i) => {
                    const isDone = done[q.id];
                    return (
                      <button
                        key={q.id}
                        onClick={() => openQuest(q.id, q.href())}
                        className="group relative flex items-center gap-5 overflow-hidden border-b border-ink-line py-6 text-left transition-colors hover:border-ink-line-strong"
                      >
                        <span className="quest-glow" aria-hidden />
                        <span
                          className={`quest-index mono text-xs ${
                            isDone ? "text-ink-white" : "text-ink-faint"
                          }`}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className={`quest-icon ${isDone ? "is-done" : ""}`}
                        >
                          <QuestIcon id={q.id} />
                        </span>
                        <span className="flex-1">
                          <span className="block text-xl text-ink-white md:text-2xl">
                            {q.label}
                          </span>
                          <span className="block text-xs text-ink-dim">
                            {q.hint}
                          </span>
                        </span>
                        <Glyph done={isDone} />
                      </button>
                    );
                  })}
                </div>
                <div className="mt-10 flex items-center justify-between">
                  <BackBtn onClick={() => setStep("handle")} />
                  <button
                    className="ink-btn"
                    disabled={!allQuestsDone}
                    onClick={() => setStep("wallet")}
                  >
                    {allQuestsDone
                      ? "Continue"
                      : `${QUESTS.filter((q) => done[q.id]).length} / ${QUESTS.length}`}
                  </button>
                </div>
              </motion.div>
            )}

            {step === "wallet" && (
              <motion.div key="wallet" {...fade}>
                <StepHeader index={3} title="Bind your wallet." />
                <p className="mb-10 text-sm leading-relaxed text-ink-dim">
                  Your {SITE.chain} address — where your ink will be inscribed.
                </p>
                <input
                  autoFocus
                  className="ink-input text-lg"
                  placeholder="0x…"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  spellCheck={false}
                  autoCapitalize="none"
                />
                <div className="mt-3 h-4">
                  {address.length > 0 && !addressOk && (
                    <span className="mono text-xs text-ink-danger">
                      Not a valid EVM address.
                    </span>
                  )}
                  {addressOk && addressTaken && (
                    <span className="mono text-xs text-ink-danger">
                      This wallet is already inked.
                    </span>
                  )}
                </div>

                <div className="mt-10">
                  <label className="kicker mb-3 block text-ink-faint">
                    Invite code · optional
                  </label>
                  <input
                    className="ink-input text-base"
                    placeholder="OBLX-XXXX-XXXX"
                    value={invite}
                    onChange={(e) => setInvite(e.target.value.toUpperCase())}
                    spellCheck={false}
                    autoCapitalize="characters"
                  />
                </div>

                {error && (
                  <p className="mono mt-6 text-xs text-ink-danger">{error}</p>
                )}

                <div className="mt-10 flex items-center justify-between">
                  <BackBtn onClick={() => setStep("quests")} />
                  <button
                    className="ink-btn"
                    disabled={!addressOk || submitting || addressTaken}
                    onClick={submit}
                  >
                    {submitting ? "Inking…" : "Seal the ritual"}
                  </button>
                </div>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div key="done" {...fade} className="text-center">
                <div className="mb-8 flex justify-center">
                  <div className="ink-rise">
                    <Mark size={110} />
                  </div>
                </div>
                <p className="kicker mb-5 text-ink-dim">Your ink is sealed</p>
                <h2 className="display mb-4 text-4xl md:text-5xl">
                  You are inscribed.
                </h2>
                {position != null && (
                  <p className="mono mb-10 text-sm text-ink-dim">
                    Position #{position.toString().padStart(4, "0")}
                  </p>
                )}

                <p className="kicker mb-3 text-ink-faint">
                  Your invite code
                </p>
                <button
                  onClick={copyCode}
                  className="group mx-auto mb-3 flex items-center gap-3 border border-ink-line-strong px-6 py-4 transition-colors hover:border-ink-white"
                  title="Click to copy"
                >
                  <span className="mono text-xl tracking-[0.2em] text-ink-white">
                    {code ?? "—"}
                  </span>
                </button>
                <p className="mono text-[0.66rem] uppercase tracking-[0.3em] text-ink-faint">
                  {copied ? "Copied to clipboard" : "Click to copy · share it"}
                </p>

                <div className="mt-12">
                  <a
                    className="ink-btn"
                    href={`https://x.com/intent/tweet?text=${encodeURIComponent(
                      `I've been inked into @${SITE.handle}. The ink remembers. oblx.ink`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Share on X
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      <footer className="px-6 py-6 md:px-12">
        <div className="mono mx-auto max-w-xl text-center text-[0.6rem] uppercase tracking-[0.3em] text-ink-faint">
          OBLX.INK · {SITE.chain} · MMXXVI
        </div>
      </footer>
    </main>
  );
}

function StepHeader({ index, title }: { index: number; title: string }) {
  return (
    <div className="mb-2">
      <span className="kicker text-ink-faint">Step {index} / 3</span>
      <h2 className="display mt-3 text-4xl md:text-5xl">{title}</h2>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="mono text-[0.66rem] uppercase tracking-[0.3em] text-ink-faint transition-colors hover:text-ink-white"
    >
      ← Back
    </button>
  );
}

function Glyph({ done }: { done: boolean }) {
  return (
    <span
      className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-colors duration-300 ${
        done ? "glyph-pop" : ""
      }`}
      style={{
        borderColor: done ? "var(--ink-white)" : "var(--ink-line-strong)",
        background: done ? "var(--ink-white)" : "transparent",
      }}
    >
      {done ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 12.5l5 5L20 6.5"
            stroke="#000"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 17L17 7M9 7h8v8"
            stroke="var(--ink-dim)"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </span>
  );
}

function XLogo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.3 3h2.9l-6.4 7.3L21.5 21h-5.9l-4.6-6-5.3 6H2.8l6.8-7.8L2.2 3h6l4.2 5.5L17.3 3zm-1 16.2h1.6L8.1 4.7H6.4l9.9 14.5z" />
    </svg>
  );
}

function QuestIcon({ id }: { id: QuestId }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (id) {
    case "follow":
      return <XLogo size={28} />;
    case "like":
      return (
        <svg {...common}>
          <path d="M12 20s-7-4.5-9.3-9C1.2 8 2.6 4.8 5.8 4.8c2 0 3.3 1.3 4.2 2.6.9-1.3 2.2-2.6 4.2-2.6 3.2 0 4.6 3.2 3.1 6.2C19 15.5 12 20 12 20z" />
        </svg>
      );
    case "reply":
      return (
        <svg {...common}>
          <path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
      );
    case "qrt":
      return (
        <svg {...common}>
          <path d="M7 17H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v9l-4-2zm10 0h-2a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v9l-4-2z" />
        </svg>
      );
  }
}
