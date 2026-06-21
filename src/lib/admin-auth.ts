import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "oblx_admin_sess";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
  const s =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_PASSWORD?.trim();
  if (!s) throw new Error("ADMIN_SESSION_SECRET or ADMIN_PASSWORD required.");
  return s;
}

export function verifyAdminCredentials(
  username: string,
  password: string,
): boolean {
  const u = process.env.ADMIN_USERNAME?.trim();
  const p = process.env.ADMIN_PASSWORD?.trim();
  if (!u || !p) return false;
  return username === u && password === p;
}

export function createSessionToken(): string {
  const exp = Date.now() + SESSION_MS;
  const payload = `admin:${exp}`;
  const sig = createHmac("sha256", secret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifySessionToken(token: string): boolean {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return false;
  const payloadB64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret()).update(payload).digest("hex");
  try {
    if (
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return false;
    }
  } catch {
    return false;
  }
  const [, expStr] = payload.split(":");
  const exp = Number(expStr);
  return Number.isFinite(exp) && exp > Date.now();
}

export async function isAdminSession(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  return token ? verifySessionToken(token) : false;
}

export async function setAdminSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MS / 1000,
  });
}

export async function clearAdminSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdminSession())) {
    throw new AdminAuthError();
  }
}

export class AdminAuthError extends Error {
  constructor() {
    super("Unauthorized");
    this.name = "AdminAuthError";
  }
}
