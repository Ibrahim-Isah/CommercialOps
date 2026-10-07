import { NextRequest, NextResponse } from "next/server";
import { advanceGrievance, type AdvanceOptions } from "@/lib/grievance/grievances";
import { withMeta } from "@/lib/grievance/derive";
import { GRIEVANCE_STEPS, type GrievanceStatus } from "@/types";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const STATUSES: GrievanceStatus[] = ["Open", "Resolved", "Closed", "Abandoned"];
const RESOLUTION_TYPES = [
  "Rapid Response",
  "First-Level Resolution",
  "GRC Resolution",
  "External Redress",
] as const;
const CLOSURE_TYPES = ["Complainant Sign-Off", "External Redress", "Abandoned"] as const;

/**
 * POST /api/grievances/:id/advance — move a case along the grievance process
 * (Figure 1) with an audit-trail entry: step changes, assignment, resolution
 * and close-out all go through here.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Request body must be an object." }, { status: 400 });
    }

    const options: AdvanceOptions = {};
    if (body.step !== undefined) {
      if (!GRIEVANCE_STEPS.includes(body.step as (typeof GRIEVANCE_STEPS)[number])) {
        return NextResponse.json({ error: "A valid process step is required." }, { status: 400 });
      }
      options.step = body.step as AdvanceOptions["step"];
    }
    if (body.status !== undefined) {
      if (!STATUSES.includes(body.status as GrievanceStatus)) {
        return NextResponse.json({ error: "A valid status is required." }, { status: 400 });
      }
      options.status = body.status as GrievanceStatus;
    }
    if (body.resolutionType !== undefined) {
      if (!RESOLUTION_TYPES.includes(body.resolutionType as (typeof RESOLUTION_TYPES)[number])) {
        return NextResponse.json({ error: "A valid resolution type is required." }, { status: 400 });
      }
      options.resolutionType = body.resolutionType as AdvanceOptions["resolutionType"];
    }
    if (body.closureType !== undefined) {
      if (!CLOSURE_TYPES.includes(body.closureType as (typeof CLOSURE_TYPES)[number])) {
        return NextResponse.json({ error: "A valid closure type is required." }, { status: 400 });
      }
      options.closureType = body.closureType as AdvanceOptions["closureType"];
    }
    for (const [key, label] of [
      ["resolvedDate", "Resolved date"],
      ["closedDate", "Closed date"],
      ["targetResolutionDate", "Target resolution date"],
    ] as const) {
      const value = body[key];
      if (value !== undefined && value !== null && value !== "") {
        if (typeof value !== "string" || !ISO_DATE.test(value)) {
          return NextResponse.json(
            { error: `${label} must be a valid date.` },
            { status: 400 }
          );
        }
        (options as Record<string, unknown>)[key] = value;
      }
    }
    for (const key of [
      "resolutionNotes",
      "closureNotes",
      "note",
      "actor",
      "responsibleDepartment",
      "responsiblePerson",
      "actionRequired",
    ] as const) {
      if (typeof body[key] === "string") {
        options[key] = (body[key] as string).trim() || undefined;
      }
    }
    if (typeof body.rapidResponse === "boolean") options.rapidResponse = body.rapidResponse;
    if (typeof body.litigation === "boolean") options.litigation = body.litigation;

    const grievance = await advanceGrievance(params.id, options);
    if (!grievance) {
      return NextResponse.json({ error: "Grievance not found." }, { status: 404 });
    }
    return NextResponse.json({ grievance: withMeta(grievance) });
  } catch (e) {
    return errorResponse(e, "Failed to update the grievance.");
  }
}
