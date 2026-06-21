import { NextResponse } from "next/server";
import { AdminAuthError, isAdminSession, requireAdmin } from "@/lib/admin-auth";
import { withDb } from "@/lib/db";
import {
  addSimEntry,
  deleteSimEntry,
  getAdminSimState,
  setAutoEnabled,
  setDisplayPercent,
  setInkBoost,
} from "@/lib/mint-sim";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!(await isAdminSession())) {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }
    const state = await withDb((client) => getAdminSimState(client));
    return NextResponse.json({ ok: true, authenticated: true, ...state });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error." }, { status: 503 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    throw e;
  }

  let body: {
    displayPercent?: number;
    inkBoost?: number;
    autoEnabled?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  try {
    await withDb(async (client) => {
      if (typeof body.displayPercent === "number") {
        await setDisplayPercent(client, body.displayPercent);
      }
      if (typeof body.inkBoost === "number") {
        await setInkBoost(client, body.inkBoost);
      }
      if (typeof body.autoEnabled === "boolean") {
        await setAutoEnabled(client, body.autoEnabled);
      }
    });
    const state = await withDb((client) => getAdminSimState(client));
    return NextResponse.json({ ok: true, ...state });
  } catch {
    return NextResponse.json({ ok: false, error: "Update failed." }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    throw e;
  }

  let body: { quantity?: number; address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid body." }, { status: 400 });
  }

  const quantity = body.quantity;
  if (!Number.isFinite(quantity) || quantity! < 1) {
    return NextResponse.json({ ok: false, error: "Invalid quantity." }, { status: 400 });
  }

  try {
    await withDb((client) =>
      addSimEntry(client, { quantity: quantity!, address: body.address }),
    );
    const state = await withDb((client) => getAdminSimState(client));
    return NextResponse.json({ ok: true, ...state });
  } catch {
    return NextResponse.json({ ok: false, error: "Could not add entry." }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });
    }
    throw e;
  }

  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ ok: false, error: "Invalid id." }, { status: 400 });
  }

  try {
    await withDb((client) => deleteSimEntry(client, id));
    const state = await withDb((client) => getAdminSimState(client));
    return NextResponse.json({ ok: true, ...state });
  } catch {
    return NextResponse.json({ ok: false, error: "Delete failed." }, { status: 503 });
  }
}
