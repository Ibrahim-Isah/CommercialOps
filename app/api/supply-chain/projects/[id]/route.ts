import { NextRequest, NextResponse } from "next/server";
import {
  assignVendor,
  deleteProject,
  getProject,
  updateProject,
} from "@/lib/supply-chain/projects";
import { parseProjectInput } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/supply-chain/projects/:id — project + status history. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getProject(params.id);
    if (!result) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, "Failed to load the project.");
  }
}

/**
 * PUT /api/supply-chain/projects/:id — update project fields.
 * Body { vendorId: string | null } alone performs a vendor (re/un)assignment;
 * a full body updates every field. Status changes use the /status endpoint.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (body && Object.keys(body).length === 1 && "vendorId" in body) {
      const vendorId = body.vendorId;
      if (vendorId !== null && typeof vendorId !== "string") {
        return NextResponse.json(
          { error: "vendorId must be a string or null." },
          { status: 400 }
        );
      }
      const project = await assignVendor(params.id, vendorId);
      if (!project) {
        return NextResponse.json({ error: "Project not found." }, { status: 404 });
      }
      return NextResponse.json({ project });
    }

    const parsed = parseProjectInput(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const project = await updateProject(params.id, parsed.data);
    if (!project) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ project });
  } catch (e) {
    return errorResponse(e, "Failed to update the project.");
  }
}

/**
 * DELETE /api/supply-chain/projects/:id — remove a project.
 * NOTE: when an auth/role system is added, restrict this to admins.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ok = await deleteProject(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "Failed to delete the project.");
  }
}
