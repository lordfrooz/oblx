"use client";

import { useCallback, useEffect, useState } from "react";
import { MINT, formatSupply } from "@/lib/mint";

interface AdminState {
  realInk: number;
  simInk: number;
  inkBoost: number;
  displayTotal: number;
  displayPercent: number;
  displayPercentLabel: string;
  autoEnabled: boolean;
  lastAutoAt: string | null;
  entries: {
    id: number;
    address: string;
    amount: number;
    quantity: number;
    txHash: string;
    createdAt: string;
  }[];
}

export default function MintAdminPanel() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [state, setState] = useState<AdminState | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [percentInput, setPercentInput] = useState("");
  const [boostInput, setBoostInput] = useState("");
  const [qtyInput, setQtyInput] = useState("1");
  const [addrInput, setAddrInput] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/mint");
    if (res.status === 401) {
      setAuthed(false);
      return;
    }
    const data = await res.json();
    if (!data.ok) return;
    setAuthed(true);
    setState(data as AdminState);
    setPercentInput(String(Number(data.displayPercent).toFixed(2)));
    setBoostInput(String(data.inkBoost));
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 20_000);
    return () => clearInterval(id);
  }, [load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setLoginError(data.error ?? "Login failed.");
        return;
      }
      setPassword("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setState(null);
  }

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/mint", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Failed.");
        return;
      }
      setState(data as AdminState);
      setPercentInput(String(Number(data.displayPercent).toFixed(2)));
      setBoostInput(String(data.inkBoost));
      setMsg("Saved.");
    } finally {
      setBusy(false);
    }
  }

  async function addFake() {
    const quantity = parseInt(qtyInput, 10);
    if (!Number.isFinite(quantity) || quantity < 1) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/mint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          quantity,
          address: addrInput.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Failed.");
        return;
      }
      setState(data as AdminState);
      setPercentInput(String(Number(data.displayPercent).toFixed(2)));
      setBoostInput(String(data.inkBoost));
      setMsg("Mint added.");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(id: number) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/mint?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setState(data as AdminState);
        setPercentInput(String(Number(data.displayPercent).toFixed(2)));
        setBoostInput(String(data.inkBoost));
      }
    } finally {
      setBusy(false);
    }
  }

  if (authed === null) {
    return (
      <div className="admin-shell">
        <p className="admin-muted">Loading…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="admin-shell">
        <form className="admin-card" onSubmit={(e) => void login(e)}>
          <h1 className="admin-title">Mint ops</h1>
          <label className="admin-label">
            Username
            <input
              className="admin-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="admin-label">
            Password
            <input
              className="admin-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {loginError && <p className="admin-error">{loginError}</p>}
          <button className="admin-btn" type="submit" disabled={busy}>
            Sign in
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <h1 className="admin-title">Mint ops</h1>
        <button type="button" className="admin-btn-ghost" onClick={() => void logout()}>
          Log out
        </button>
      </header>

      {state && (
        <>
          <section className="admin-card">
            <h2 className="admin-h2">Overview</h2>
            <dl className="admin-dl">
              <div>
                <dt>Real minted</dt>
                <dd>{formatSupply(state.realInk)} ink</dd>
              </div>
              <div>
                <dt>Sim entries</dt>
                <dd>{formatSupply(state.simInk)} ink</dd>
              </div>
              <div>
                <dt>Ink boost</dt>
                <dd>{formatSupply(state.inkBoost)} ink</dd>
              </div>
              <div>
                <dt>Display total</dt>
                <dd>
                  {formatSupply(state.displayTotal)} ({state.displayPercentLabel}%)
                </dd>
              </div>
              <div>
                <dt>Real remaining</dt>
                <dd>{formatSupply(MINT.totalSupply - state.realInk)}</dd>
              </div>
            </dl>
          </section>

          <section className="admin-card">
            <h2 className="admin-h2">Display progress</h2>
            <p className="admin-hint">
              Does not reduce real supply — only changes what users see.
            </p>
            <div className="admin-row">
              <label className="admin-label-inline">
                Target %
                <input
                  className="admin-input"
                  value={percentInput}
                  onChange={(e) => setPercentInput(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={() =>
                  void patch({ displayPercent: parseFloat(percentInput) })
                }
              >
                Apply %
              </button>
            </div>
            <div className="admin-row">
              <label className="admin-label-inline">
                Ink boost
                <input
                  className="admin-input"
                  value={boostInput}
                  onChange={(e) => setBoostInput(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={() =>
                  void patch({ inkBoost: parseInt(boostInput, 10) || 0 })
                }
              >
                Apply boost
              </button>
            </div>
            <label className="admin-check">
              <input
                type="checkbox"
                checked={state.autoEnabled}
                onChange={(e) => void patch({ autoEnabled: e.target.checked })}
              />
              Auto fake mint every 2 minutes
            </label>
          </section>

          <section className="admin-card">
            <h2 className="admin-h2">Add fake mint</h2>
            <div className="admin-row">
              <label className="admin-label-inline">
                Units
                <input
                  className="admin-input admin-input-sm"
                  value={qtyInput}
                  onChange={(e) => setQtyInput(e.target.value)}
                />
              </label>
              <label className="admin-label-inline admin-grow">
                Wallet (optional)
                <input
                  className="admin-input"
                  placeholder="0x… random if empty"
                  value={addrInput}
                  onChange={(e) => setAddrInput(e.target.value)}
                />
              </label>
              <button
                type="button"
                className="admin-btn"
                disabled={busy}
                onClick={() => void addFake()}
              >
                Add
              </button>
            </div>
          </section>

          <section className="admin-card">
            <h2 className="admin-h2">Simulated entries ({state.entries.length})</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Wallet</th>
                    <th>Qty</th>
                    <th>Amount</th>
                    <th>When</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{e.address.slice(0, 8)}…{e.address.slice(-4)}</td>
                      <td>{e.quantity}</td>
                      <td>{formatSupply(e.amount)}</td>
                      <td>{new Date(e.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="admin-btn-ghost"
                          onClick={() => void removeEntry(e.id)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {msg && <p className="admin-msg">{msg}</p>}
    </div>
  );
}
