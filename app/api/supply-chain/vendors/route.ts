import { NextRequest, NextResponse } from "next/server";
import { createVendor, listVendors } from "@/lib/supply-chain/vendors";
import { parseVendorInput } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/supply-chain/vendors — vendor list with per-vendor stats. */
export async function GET() {
  try {
    return NextResponse.json({ vendors: await listVendors() });
  } catch (e) {
    return errorResponse(e, "Failed to load vendors.");
  }
}

/** POST /api/supply-chain/vendors — create a vendor. */
export async function POST(req: NextRequest) {
  try {
    const parsed = parseVendorInput(await req.json().catch(() => null));
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const vendor = await createVendor(parsed.data);
    return NextResponse.json({ vendor }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to create the vendor.");
  }
}
