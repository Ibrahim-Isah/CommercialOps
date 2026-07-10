import { NextRequest, NextResponse } from "next/server";
import { changeProjectStatus } from "@/lib/supply-chain/projects";
import { PROJECT_STATUSES } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";
import type { SupplyProjectStatus } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * POST /api/supply-chain/projects/:id/status — change status with audit trail.
 * Completing a project requires the actual completion date and a final cost
 * (if none is recorded yet) so savings can be calculated.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => null)) as {
      status?: SupplyProjectStatus;
      note?: string;
      actualCompletionDate?: string;
      finalCost?: number;
    } | null;

    const status = body?.status;
    if (!status || !PROJECT_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: "A valid status is required." },
        { status: 400 }
      );
    }
    if (status === "completed") {
      if (!body?.actualCompletionDate || !ISO_DATE.test(body.actualCompletionDate)) {
        return NextResponse.json(
          { error: "Completing a project requires the actual completion date." },
          { status: 400 }
        );
      }
    }
    if (body?.finalCost !== undefined) {
      const n = Number(body.finalCost);
      if (!Number.isFinite(n) || n < 0) {
        return NextResponse.json(
          { error: "Final cost must be a non-negative number." },
          { status: 400 }
        );
      }
    }

    const project = await changeProjectStatus(params.id, status, {
      note: typeof body?.note === "string" ? body.note.trim() || undefined : undefined,
      actualCompletionDate: body?.actualCompletionDate,
      finalCost: body?.finalCost,
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (e) {
    return errorResponse(e, "Failed to change the project status.");
  }
}
