import { NextRequest, NextResponse } from "next/server";
import { addDocument, uploadDocumentFile } from "@/lib/supply-chain/vendors";
import { parseDocumentInput } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/supply-chain/vendors/:id/documents — add a document.
 * Accepts multipart form data: the document fields plus an optional `file`,
 * which is uploaded to the vendor-documents storage bucket.
 */
export async function POST(
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
    const fileUrl =
      file instanceof File && file.size > 0
        ? await uploadDocumentFile(params.id, file)
        : undefined;
    const document = await addDocument(params.id, parsed.data, fileUrl);
    return NextResponse.json({ document }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to add the document.");
  }
}
