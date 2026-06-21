import { NextResponse } from "next/server";
import { getMintStats } from "@/lib/mints";

export const runtime = "nodejs";

export async function GET() {
  try {
    const stats = await getMintStats();
    return NextResponse.json({ ok: true, ...stats });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not load mint stats." },
      { status: 503 },
    );
  }
}
