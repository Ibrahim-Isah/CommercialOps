import { NextRequest, NextResponse } from "next/server";
import { getVessel } from "@/lib/vessels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A cache miss may listen on the AIS WebSocket for several seconds.
export const maxDuration = 30;

/** GET /api/vessels/:mmsi — details for a single vessel. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { mmsi: string } }
) {
  try {
    const result = await getVessel(params.mmsi);
    if (!result) {
      return NextResponse.json(
        { error: "Vessel not found. It may have dropped off AIS coverage." },
        { status: 404 }
      );
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to load vessel." },
      { status: 500 }
    );
  }
}
