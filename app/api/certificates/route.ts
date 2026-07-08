import { NextRequest, NextResponse } from "next/server";
import { createCertificate, listCertificates, StoreError } from "@/lib/store";
import { decorate } from "@/lib/certificates";
import { parseCertificateInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(e: unknown, fallback: string) {
  const message = e instanceof StoreError ? e.message : fallback;
  return NextResponse.json({ error: message }, { status: 500 });
}

/** GET /api/certificates — list all certificates with computed status. */
export async function GET() {
  try {
    const certs = decorate(await listCertificates());
    return NextResponse.json({ certificates: certs });
  } catch (e) {
    return errorResponse(e, "Failed to load certificates.");
  }
}

/** POST /api/certificates — create a certificate. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = parseCertificateInput(body);
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const cert = await createCertificate(parsed.data);
    return NextResponse.json({ certificate: cert }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to create certificate.");
  }
}
