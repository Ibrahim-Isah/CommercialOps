import { NextRequest, NextResponse } from "next/server";
import { deleteCertificate, updateCertificate } from "@/lib/store";
import { withStatus } from "@/lib/certificates";
import { parseCertificateInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** PUT /api/certificates/:id — update a certificate. */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = parseCertificateInput(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const updated = updateCertificate(params.id, parsed.data);
    if (!updated) {
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ certificate: withStatus(updated) });
  } catch {
    return NextResponse.json(
      { error: "Failed to update certificate." },
      { status: 500 }
    );
  }
}

/** DELETE /api/certificates/:id — remove a certificate. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ok = deleteCertificate(params.id);
    if (!ok) {
      return NextResponse.json(
        { error: "Certificate not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete certificate." },
      { status: 500 }
    );
  }
}
