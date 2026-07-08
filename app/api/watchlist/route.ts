import { NextRequest, NextResponse } from "next/server";
import {
  addToWatchlist,
  listWatchlist,
  removeFromWatchlist,
  StoreError,
} from "@/lib/store";
import type { Vessel } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(e: unknown, fallback: string) {
  const message = e instanceof StoreError ? e.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

/** GET /api/watchlist — persisted tracked vessels. */
export async function GET() {
  try {
    return NextResponse.json({ vessels: await listWatchlist() });
  } catch (e) {
    return errorResponse(e, "Failed to load watchlist.");
  }
}

/** POST /api/watchlist — add (or refresh) a vessel in the watchlist. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const vessel = (body as { vessel?: Vessel })?.vessel;
    if (!vessel || !vessel.mmsi) {
      return NextResponse.json(
        { error: "A vessel with an MMSI is required." },
        { status: 400 }
      );
    }
    const vessels = await addToWatchlist(vessel);
    return NextResponse.json({ vessels });
  } catch (e) {
    return errorResponse(e, "Failed to update watchlist.");
  }
}

/** DELETE /api/watchlist?mmsi=... — remove a vessel from the watchlist. */
export async function DELETE(req: NextRequest) {
  try {
    const mmsi = req.nextUrl.searchParams.get("mmsi");
    if (!mmsi) {
      return NextResponse.json(
        { error: "mmsi query parameter is required." },
        { status: 400 }
      );
    }
    const vessels = await removeFromWatchlist(mmsi);
    return NextResponse.json({ vessels });
  } catch (e) {
    return errorResponse(e, "Failed to update watchlist.");
  }
}
