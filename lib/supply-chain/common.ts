/**
 * Shared server-side helpers for the supply chain data layer.
 * Mirrors the error posture of lib/store.ts: failures become StoreError with
 * a message that is safe and useful to surface to the user.
 */
import { StoreError } from "@/lib/store";

export function fail(
  action: string,
  error: { code?: string; message?: string }
): never {
  if (error.code === "PGRST205" || /schema cache/i.test(error.message ?? "")) {
    throw new StoreError(
      "Supply chain tables are missing. Run supabase/supply-chain-schema.sql in the Supabase SQL editor, then try again."
    );
  }
  throw new StoreError(
    `Failed to ${action}. (${error.message ?? "unknown database error"})`
  );
}

/** Postgres "invalid input syntax" (e.g. a non-UUID id) — treat as not found. */
export function isInvalidInput(error: { code?: string }): boolean {
  return error.code === "22P02";
}

/** Unique-constraint violation (e.g. duplicate buyer email). */
export function isUniqueViolation(error: { code?: string }): boolean {
  return error.code === "23505";
}
