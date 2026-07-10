import { NextRequest, NextResponse } from "next/server";
import {
  deleteVendor,
  getVendor,
  updateVendor,
} from "@/lib/supply-chain/vendors";
import { listProjects } from "@/lib/supply-chain/projects";
import { parseVendorInput } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/supply-chain/vendors/:id — vendor + documents + its projects. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getVendor(params.id);
    if (!result) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }
    const projects = (await listProjects()).filter(
      (p) => p.vendorId === params.id
    );
    return NextResponse.json({ ...result, projects });
  } catch (e) {
    return errorResponse(e, "Failed to load the vendor.");
  }
}

/** PUT /api/supply-chain/vendors/:id — update a vendor. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parsed = parseVendorInput(await req.json().catch(() => null));
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const vendor = await updateVendor(params.id, parsed.data);
    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }
    return NextResponse.json({ vendor });
  } catch (e) {
    return errorResponse(e, "Failed to update the vendor.");
  }
}

/**
 * DELETE /api/supply-chain/vendors/:id — remove a vendor.
 * Blocked (409) while the vendor still has ongoing/delayed projects.
 * NOTE: when an auth/role system is added, restrict this to admins.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await deleteVendor(params.id);
    if (result === "notfound") {
      return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    }
    if (result === "blocked") {
      return NextResponse.json(
        {
          error:
            "This vendor still has active projects. Reassign or close those projects first.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "Failed to delete the vendor.");
  }
}
