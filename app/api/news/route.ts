import { NextRequest, NextResponse } from "next/server";
import { getNews } from "@/lib/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/news?refresh=1 — aggregated oil & gas headlines. */
export async function GET(req: NextRequest) {
  try {
    const force = req.nextUrl.searchParams.get("refresh") === "1";
    const news = await getNews(force);
    return NextResponse.json(news);
  } catch {
    return NextResponse.json(
      { error: "Failed to load news." },
      { status: 500 }
    );
  }
}
