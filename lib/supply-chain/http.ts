/** Shared API-route error responder for the supply chain endpoints. */
import { NextResponse } from "next/server";
import { StoreError } from "@/lib/store";

export function errorResponse(e: unknown, fallback: string, status = 500) {
  const message = e instanceof StoreError ? e.message : fallback;
  return NextResponse.json({ error: message }, { status });
}
