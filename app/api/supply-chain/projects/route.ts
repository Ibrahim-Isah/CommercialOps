import { NextRequest, NextResponse } from "next/server";
import { createProject, listProjects } from "@/lib/supply-chain/projects";
import { parseProjectInput } from "@/lib/supply-chain/validation";
import { errorResponse } from "@/lib/supply-chain/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/supply-chain/projects — all projects with vendor/buyer names. */
export async function GET() {
  try {
    return NextResponse.json({ projects: await listProjects() });
  } catch (e) {
    return errorResponse(e, "Failed to load projects.");
  }
}

/** POST /api/supply-chain/projects — create a project (status: ongoing). */
export async function POST(req: NextRequest) {
  try {
    const parsed = parseProjectInput(await req.json().catch(() => null));
    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const project = await createProject(parsed.data);
    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return errorResponse(e, "Failed to create the project.");
  }
}
