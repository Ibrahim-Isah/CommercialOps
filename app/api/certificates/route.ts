import { NextRequest, NextResponse } from "next/server";
import { createCertificate, listCertificates } from "@/lib/store";
import { decorate } from "@/lib/certificates";
import { parseCertificateInput } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/certificates — list all certificates with computed status. */
export async function GET() {
  try {
    const certs = decorate(listCertificates());
    return NextResponse.json({ certificates: certs });
  } catch {
    return NextResponse.json(
      { error: "Failed to load certificates." },
      { status: 500 }
    );
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
    const cert = createCertificate(parsed.data);
    return NextResponse.json({ certificate: cert }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create certificate." },
      { status: 500 }
    );
  }
}
