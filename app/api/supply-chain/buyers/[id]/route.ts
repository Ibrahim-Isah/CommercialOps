import { NextRequest, NextResponse } from "next/server";
import {
  deleteBuyer,
  getBuyer,
  updateBuyer,
} from "@/lib/supply-chain/projects";
import { parseBuyerInput } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/supply-chain/buyers/:id — buyer + their projects + activity. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await getBuyer(params.id);
    if (!result) {
      return NextResponse.json({ error: "Buyer not found." }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, "Failed to load the buyer.");
  }
}

/** PUT /api/supply-chain/buyers/:id — update a buyer. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const parsed = parseBuyerInput(await req.json().catch(() => null));
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const buyer = await updateBuyer(params.id, parsed.data);
    if (!buyer) {
      return NextResponse.json({ error: "Buyer not found." }, { status: 404 });
    }
    return NextResponse.json({ buyer });
  } catch (e) {
    return errorResponse(e, "Failed to update the buyer.");
  }
}

/**
 * DELETE /api/supply-chain/buyers/:id — remove a buyer.
 * Blocked (409) while the buyer still handles projects.
 * NOTE: when an auth/role system is added, restrict this to admins.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const result = await deleteBuyer(params.id);
    if (result === "notfound") {
      return NextResponse.json({ error: "Buyer not found." }, { status: 404 });
    }
    if (result === "blocked") {
      return NextResponse.json(
        {
          error:
            "This buyer still handles projects. Reassign those projects to another buyer first.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "Failed to delete the buyer.");
  }
}
