import { NextRequest, NextResponse } from "next/server";
import { getFleet, matchesVesselQuery } from "@/lib/vessels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The live AIS collection listens on a WebSocket for several seconds.
export const maxDuration = 30;

/**
 * GET /api/vessels?q=&refresh=1 — browsable fleet list (cached live AIS
 * snapshot or the mock fleet), optionally filtered by name/IMO/MMSI/etc.
 */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
    const { vessels, isMock } = await getFleet({ forceRefresh });
    const filtered = q ? vessels.filter((v) => matchesVesselQuery(q, v)) : vessels;
    return NextResponse.json({ vessels: filtered, isMock });
  } catch {
    return NextResponse.json(
      { error: "Failed to load vessels." },
      { status: 500 }
    );
  }
}
