import { NextResponse } from "next/server";
import { getSupplyChainAnalytics } from "@/lib/supply-chain/analytics";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/supply-chain/analytics — every dashboard aggregate in one call. */
export async function GET() {
  try {
    return NextResponse.json({ analytics: await getSupplyChainAnalytics() });
  } catch (e) {
    return errorResponse(e, "Failed to load supply chain analytics.");
  }
}
