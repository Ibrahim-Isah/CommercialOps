import { NextRequest, NextResponse } from "next/server";
import { getBrentSeries, sliceSeries } from "@/lib/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RANGE_DAYS: Record<string, number> = {
  "30": 30,
  "90": 90,
  "365": 365,
};

/** GET /api/prices?range=30|90|365 — Brent series + window stats. */
export async function GET(req: NextRequest) {
  try {
    const range = req.nextUrl.searchParams.get("range") ?? "30";
    const days = RANGE_DAYS[range] ?? 30;
    const full = await getBrentSeries();
    return NextResponse.json(sliceSeries(full, days));
  } catch {
    return NextResponse.json(
      { error: "Failed to load price data." },
      { status: 500 }
    );
  }
}
