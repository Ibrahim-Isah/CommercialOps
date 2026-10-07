import { NextRequest, NextResponse } from "next/server";
import { createGrievance, listGrievances } from "@/lib/grievance/grievances";
import { decorate } from "@/lib/grievance/derive";
import { parseGrievanceInput } from "@/lib/grievance/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/grievances — the grievance register with derived case metadata. */
export async function GET() {
  try {
    return NextResponse.json({ grievances: decorate(await listGrievances()) });
  } catch (e) {
    return errorResponse(e, "Failed to load grievances.");
  }
}

/** POST /api/grievances — register a grievance (Phase 1: Receive & Register). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = parseGrievanceInput(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const grievance = await createGrievance(parsed.data);
    return NextResponse.json({ grievance }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to register the grievance.");
  }
}
