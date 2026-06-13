import { NextRequest, NextResponse } from "next/server";
import { getBrentSeries } from "@/lib/prices";
import { buildForecast } from "@/lib/forecast";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HORIZONS = new Set([7, 14, 30]);

/** GET /api/forecast?horizon=7|14|30 — statistical Brent projection. */
export async function GET(req: NextRequest) {
  try {
    const raw = Number(req.nextUrl.searchParams.get("horizon") ?? "14");
    const horizon = HORIZONS.has(raw) ? raw : 14;
    const series = await getBrentSeries();
    const result = buildForecast(
      series.points,
      horizon,
      series.label,
      series.isMock
    );
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to build forecast." },
      { status: 500 }
    );
  }
}
