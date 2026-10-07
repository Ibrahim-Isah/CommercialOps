import { NextRequest, NextResponse } from "next/server";
import { logGrievanceEvent } from "@/lib/grievance/grievances";
import type { GrievanceEventType } from "@/types";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENT_TYPES: GrievanceEventType[] = [
  "engagement",
  "reminder",
  "escalation",
  "note",
  "response",
];

/**
 * POST /api/grievances/:id/events — log engagement activity on a case
 * (engagement during investigation, reminders, escalations) without
 * changing its lifecycle state (§3.1 Engagement During Investigation).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => null)) as {
      type?: GrievanceEventType;
      note?: string;
      actor?: string;
    } | null;
    const type = body?.type;
    if (!type || !EVENT_TYPES.includes(type)) {
      return NextResponse.json(
        { error: "A valid event type is required." },
        { status: 400 }
      );
    }
    const event = await logGrievanceEvent(
      params.id,
      type,
      typeof body?.note === "string" ? body.note : undefined,
      typeof body?.actor === "string" ? body.actor : undefined
    );
    if (!event) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }
    return NextResponse.json({ event }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to record the grievance event.");
  }
}
