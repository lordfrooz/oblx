import { NextResponse } from "next/server";
import { isAddress } from "viem";
import {
  createClaim,
  findByAddress,
  findByCode,
  findByHandle,
  normalizeHandle,
} from "@/lib/claims";
import { registrationsOpen } from "@/lib/registrations";
import {
  bodyTooLarge,
  clientIp,
  INVITE_RE,
  rateLimit,
} from "@/lib/rate-limit";

export const runtime = "nodejs";

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const REQUIRED_QUESTS = ["follow", "reply", "qrt", "like"] as const;

function rateLimited(retryAfterSec: number) {
  return NextResponse.json(
    { ok: false, error: "Too many requests. Try again shortly." },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

function invalidHandle() {
  return NextResponse.json(
    { ok: false, error: "Invalid X handle." },
    { status: 400 },
  );
}

/** GET /api/claim?handle=foo | ?address=0x… — lookup existing registration */
export async function GET(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`claim:get:${ip}`, 40, 60_000);
  if (!limited.ok) return rateLimited(limited.retryAfterSec);

  const params = new URL(req.url).searchParams;
  const handle = normalizeHandle(params.get("handle") ?? "");
  const address = (params.get("address") ?? "").trim();

  if (handle && address) {
    return NextResponse.json(
      { ok: false, error: "Provide handle or address, not both." },
      { status: 400 },
    );
  }

  try {
    if (handle) {
      if (!HANDLE_RE.test(handle)) return invalidHandle();
      const claim = await findByHandle(handle);
      if (!claim) return NextResponse.json({ ok: true, found: false });
      return NextResponse.json({
        ok: true,
        found: true,
        code: claim.code,
        position: claim.position,
        returning: true,
      });
    }

    if (address) {
      if (!isAddress(address)) {
        return NextResponse.json(
          { ok: false, error: "Invalid EVM address." },
          { status: 400 },
        );
      }
      const claim = await findByAddress(address);
      if (!claim) return NextResponse.json({ ok: true, found: false });
      return NextResponse.json({
        ok: true,
        found: true,
        taken: true,
        handle: claim.handle,
      });
    }

    return NextResponse.json(
      { ok: false, error: "Missing handle or address." },
      { status: 400 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Database unavailable." },
      { status: 503 },
    );
  }
}

/** POST /api/claim — register a new inscription */
export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`claim:post:${ip}`, 8, 60_000);
  if (!limited.ok) return rateLimited(limited.retryAfterSec);

  if (bodyTooLarge(req)) {
    return NextResponse.json(
      { ok: false, error: "Request too large." },
      { status: 413 },
    );
  }

  let body: {
    handle?: string;
    address?: string;
    invite?: string | null;
    quests?: Record<string, boolean>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed request." },
      { status: 400 },
    );
  }

  const handle = normalizeHandle(body.handle ?? "");
  const address = (body.address ?? "").trim();
  const quests = body.quests ?? {};
  const inviteRaw = body.invite?.trim() || null;

  if (!handle || !HANDLE_RE.test(handle)) return invalidHandle();
  if (!isAddress(address)) {
    return NextResponse.json(
      { ok: false, error: "Invalid EVM address." },
      { status: 400 },
    );
  }
  if (!REQUIRED_QUESTS.every((q) => quests[q] === true)) {
    return NextResponse.json(
      { ok: false, error: "Complete every step of the ritual first." },
      { status: 400 },
    );
  }

  try {
    const existing = await findByHandle(handle);
    if (existing) {
      return NextResponse.json({
        ok: true,
        code: existing.code,
        position: existing.position,
        returning: true,
      });
    }

    if (!registrationsOpen()) {
      return NextResponse.json(
        { ok: false, error: "Registrations are closed.", closed: true },
        { status: 403 },
      );
    }

    if (inviteRaw) {
      const invite = inviteRaw.toUpperCase();
      if (!INVITE_RE.test(invite)) {
        return NextResponse.json(
          { ok: false, error: "Invalid invite code format." },
          { status: 400 },
        );
      }
      const referrer = await findByCode(invite);
      if (!referrer) {
        return NextResponse.json(
          { ok: false, error: "Invite code not found." },
          { status: 400 },
        );
      }
    }

    const result = await createClaim({
      handle,
      address,
      invite: inviteRaw ? inviteRaw.toUpperCase() : null,
      quests,
    });

    if (result.kind === "returning") {
      return NextResponse.json({
        ok: true,
        code: result.claim.code,
        position: result.claim.position,
        returning: true,
      });
    }

    if (result.kind === "address_taken") {
      return NextResponse.json(
        {
          ok: false,
          error: "This wallet is already inked to another handle.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      ok: true,
      code: result.claim.code,
      position: result.claim.position,
    });
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code: string }).code === "23505"
    ) {
      const existing = await findByHandle(handle);
      if (existing) {
        return NextResponse.json({
          ok: true,
          code: existing.code,
          position: existing.position,
          returning: true,
        });
      }
      return NextResponse.json(
        { ok: false, error: "This wallet or handle is already inked." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Database unavailable." },
      { status: 503 },
    );
  }
}
