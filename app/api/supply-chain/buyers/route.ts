import { NextRequest, NextResponse } from "next/server";
import { createBuyer, listBuyersWithStats } from "@/lib/supply-chain/projects";
import { parseBuyerInput } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/supply-chain/buyers — all procurement staff with their stats. */
export async function GET() {
  try {
    return NextResponse.json({ buyers: await listBuyersWithStats() });
  } catch (e) {
    return errorResponse(e, "Failed to load buyers.");
  }
}

/** POST /api/supply-chain/buyers — create a buyer. */
export async function POST(req: NextRequest) {
  try {
    const parsed = parseBuyerInput(await req.json().catch(() => null));
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const buyer = await createBuyer(parsed.data);
    return NextResponse.json({ buyer }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to create the buyer.");
  }
}
