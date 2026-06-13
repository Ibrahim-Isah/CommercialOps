import { NextRequest, NextResponse } from "next/server";
import { searchVessels } from "@/lib/vessels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// The live AIS lookup listens on a WebSocket for several seconds.
export const maxDuration = 30;

/** GET /api/vessels?q=name|imo|mmsi — search live AIS or mock fleet. */
export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get("q") ?? "";
    const { vessels, isMock } = await searchVessels(q);
    return NextResponse.json({ vessels, isMock });
  } catch {
    return NextResponse.json(
      { error: "Failed to search vessels." },
      { status: 500 }
    );
  }
}
