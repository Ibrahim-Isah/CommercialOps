import { NextRequest, NextResponse } from "next/server";
import { deleteDocument, updateDocument, uploadDocumentFile } from "@/lib/supply-chain/vendors";
import { parseDocumentInput } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * PUT /api/supply-chain/documents/:id — update a vendor document.
 * Multipart form data; a new `file` replaces the stored one, `vendorId` is
 * required only when a file is attached (it namespaces the storage path).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const form = await req.formData();
    const parsed = parseDocumentInput(Object.fromEntries(form.entries()));
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const file = form.get("file");
    const vendorId = form.get("vendorId");
    let fileUrl: string | undefined;
    if (file instanceof File && file.size > 0) {
      if (typeof vendorId !== "string" || !vendorId) {
        return NextResponse.json(
          { error: "vendorId is required when uploading a file." },
          { status: 400 }
        );
      }
      fileUrl = await uploadDocumentFile(vendorId, file);
    }
    const document = await updateDocument(params.id, parsed.data, fileUrl);
    if (!document) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return NextResponse.json({ document });
  } catch (e) {
    return errorResponse(e, "Failed to update the document.");
  }
}

/** DELETE /api/supply-chain/documents/:id — remove a vendor document. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const ok = await deleteDocument(params.id);
    if (!ok) {
      return NextResponse.json({ error: "Document not found." }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return errorResponse(e, "Failed to delete the document.");
  }
}
