import { NextResponse } from "next/server";
import { getGrievanceAnalytics } from "@/lib/grievance/analytics";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/grievances/analytics — quarterly-review KPI aggregates (§6.8). */
export async function GET() {
  try {
    return NextResponse.json({ analytics: await getGrievanceAnalytics() });
  } catch (e) {
    return errorResponse(e, "Failed to load grievance analytics.");
  }
}
