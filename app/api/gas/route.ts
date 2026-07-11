import { NextResponse } from "next/server";
import { getGasData } from "@/lib/gas";
import { StoreError } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/gas — benchmark history (HH/TTF/JKM) + Nigeria PIA prices. */
export async function GET() {
  try {
    return NextResponse.json(await getGasData());
  } catch (e) {
    const message =
      e instanceof StoreError ? e.message : "Failed to load gas price data.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
