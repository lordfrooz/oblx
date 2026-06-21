import { NextResponse } from "next/server";
import { recordMint } from "@/lib/mints";
import { verifyMintTx } from "@/lib/mint-verify";
import { bodyTooLarge, clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`mints:post:${ip}`, 20, 60_000);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: "Too many requests." },
      { status: 429 },
    );
  }

  if (bodyTooLarge(req, 512)) {
    return NextResponse.json(
      { ok: false, error: "Request too large." },
      { status: 413 },
    );
  }

  let body: { txHash?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed request." },
      { status: 400 },
    );
  }

  const txHash = body.txHash?.trim();
  if (!txHash || !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
    return NextResponse.json(
      { ok: false, error: "Invalid transaction hash." },
      { status: 400 },
    );
  }

  try {
    const verified = await verifyMintTx(txHash);
    if (!verified) {
      return NextResponse.json(
        { ok: false, error: "Transaction could not be verified." },
        { status: 400 },
      );
    }

    const result = await recordMint(verified);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.error },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, duplicate: result.duplicate });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not record mint." },
      { status: 503 },
    );
  }
}
