import { NextRequest, NextResponse } from "next/server";
import {
  deleteGrievance,
  getGrievance,
  updateGrievance,
} from "@/lib/grievance/grievances";
import { withMeta } from "@/lib/grievance/derive";
import { parseGrievanceInput } from "@/lib/grievance/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/grievances/:id — one case with its audit trail. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getGrievance(params.id);
    if (!result) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }
    return NextResponse.json({
      grievance: withMeta(result.grievance),
      events: result.events,
    });
  } catch (e) {
    return errorResponse(e, "Failed to load the grievance.");
  }
}

/** PUT /api/grievances/:id — edit registration fields. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = parseGrievanceInput(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const grievance = await updateGrievance(params.id, parsed.data);
    if (!grievance) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }
    return NextResponse.json({ grievance: withMeta(grievance) });
  } catch (e) {
    return errorResponse(e, "Failed to update the grievance.");
  }
}

/** DELETE /api/grievances/:id — remove a case and its history. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const deleted = await deleteGrievance(params.id);
    if (!deleted) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, "Failed to delete the grievance.");
  }
}
