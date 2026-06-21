import { NextResponse } from "next/server";
import {
  createSessionToken,
  setAdminSessionCookie,
  verifyAdminCredentials,
} from "@/lib/admin-auth";
import { bodyTooLarge, clientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const limited = rateLimit(`admin:login:${ip}`, 8, 60_000);
  if (!limited.ok) {
    return NextResponse.json({ ok: false, error: "Too many attempts." }, { status: 429 });
  }

  if (bodyTooLarge(req, 1024)) {
    return NextResponse.json({ ok: false, error: "Request too large." }, { status: 413 });
  }

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const username = body.username?.trim() ?? "";
  const password = body.password ?? "";

  if (!verifyAdminCredentials(username, password)) {
    return NextResponse.json({ ok: false, error: "Invalid credentials." }, { status: 401 });
  }

  const token = createSessionToken();
  await setAdminSessionCookie(token);
  return NextResponse.json({ ok: true });
}
