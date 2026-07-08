/**
 * Supabase-backed data store.
 *
 * ALL persistence logic lives in this one module — API routes only call the
 * exported functions, so the backing database can be swapped without touching
 * them. Tables are defined in supabase/schema.sql (run once in the Supabase
 * SQL editor).
 *
 * Persists: certificates and the vessel watchlist.
 *
 * First run: seeds example certificates, importing any data found in the
 * legacy JSON store (data/store.json) so nothing is lost in the migration.
 */
import fs from "node:fs";
import path from "node:path";
import type { Certificate, CertificateInput, Vessel } from "@/types";
import { seedCertificates } from "@/lib/mock-data";
import { getSupabase } from "@/lib/supabase";

/** Store failures whose message is safe and useful to show to the user. */
export class StoreError extends Error {}

const SEEDED_KEY = "store_seeded";

interface CertificateRow {
  id: string;
  name: string;
  issuing_body: string;
  category: Certificate["category"];
  registration_date: string;
  expiration_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToCertificate(row: CertificateRow): Certificate {
  return {
    id: row.id,
    name: row.name,
    issuingBody: row.issuing_body,
    category: row.category,
    registrationDate: row.registration_date,
    expirationDate: row.expiration_date,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function certificateToRow(c: Certificate): CertificateRow {
  return {
    id: c.id,
    name: c.name,
    issuing_body: c.issuingBody,
    category: c.category,
    registration_date: c.registrationDate,
    expiration_date: c.expirationDate,
    notes: c.notes ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

/** Postgres "invalid input syntax" (e.g. a non-UUID id) — treat as not found. */
function isInvalidInput(error: { code?: string }): boolean {
  return error.code === "22P02";
}

function fail(action: string, error: { code?: string; message?: string }): never {
  // PGRST205: PostgREST cannot find the table — the schema was never applied.
  if (error.code === "PGRST205" || /schema cache/i.test(error.message ?? "")) {
    throw new StoreError(
      "Database tables are missing. Run supabase/schema.sql in the Supabase SQL editor, then try again."
    );
  }
  throw new StoreError(`Failed to ${action}. (${error.message ?? "unknown database error"})`);
}

// --- One-time seed / legacy migration ---------------------------------------

/** Read the pre-Supabase JSON store, if it exists, so its data migrates over. */
function readLegacyStore():
  | { certificates: Certificate[]; watchlist: Vessel[] }
  | undefined {
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), "data", "store.json"),
      "utf-8"
    );
    const parsed = JSON.parse(raw) as {
      certificates?: Certificate[];
      watchlist?: Vessel[];
    };
    return {
      certificates: parsed.certificates ?? [],
      watchlist: parsed.watchlist ?? [],
    };
  } catch {
    // Missing or unreadable (e.g. read-only serverless bundle) — nothing to migrate.
    return undefined;
  }
}

const g = globalThis as unknown as { __storeSeeded?: boolean };

/**
 * Seed the database on first touch. The app_settings row acts as the flag;
 * ignoreDuplicates makes the claim atomic, so concurrent first requests
 * cannot double-seed.
 */
async function ensureSeeded(): Promise<void> {
  if (g.__storeSeeded) return;
  const sb = getSupabase();

  const { data: claimed, error } = await sb
    .from("app_settings")
    .upsert(
      { key: SEEDED_KEY, value: { seededAt: new Date().toISOString() } },
      { onConflict: "key", ignoreDuplicates: true }
    )
    .select("key");
  if (error) fail("initialise the database", error);

  if (claimed && claimed.length > 0) {
    // We won the first-run claim: import legacy data or the demo seeds.
    const legacy = readLegacyStore();
    const certs = legacy?.certificates.length
      ? legacy.certificates
      : seedCertificates();
    const { error: certError } = await sb
      .from("certificates")
      .insert(certs.map(certificateToRow));
    if (certError) fail("seed certificates", certError);

    if (legacy?.watchlist.length) {
      const { error: wlError } = await sb.from("watchlist").upsert(
        legacy.watchlist.map((v) => ({ mmsi: v.mmsi, vessel: v })),
        { onConflict: "mmsi" }
      );
      if (wlError) fail("migrate the watchlist", wlError);
    }
  }
  g.__storeSeeded = true;
}

// --- Certificates ------------------------------------------------------------

export async function listCertificates(): Promise<Certificate[]> {
  await ensureSeeded();
  const { data, error } = await getSupabase()
    .from("certificates")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) fail("load certificates", error);
  return ((data ?? []) as CertificateRow[]).map(rowToCertificate);
}

export async function createCertificate(
  input: CertificateInput
): Promise<Certificate> {
  await ensureSeeded();
  const { data, error } = await getSupabase()
    .from("certificates")
    .insert({
      name: input.name,
      issuing_body: input.issuingBody,
      category: input.category,
      registration_date: input.registrationDate,
      expiration_date: input.expirationDate,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();
  if (error) fail("create the certificate", error);
  return rowToCertificate(data as CertificateRow);
}

export async function updateCertificate(
  id: string,
  input: CertificateInput
): Promise<Certificate | undefined> {
  await ensureSeeded();
  const { data, error } = await getSupabase()
    .from("certificates")
    .update({
      name: input.name,
      issuing_body: input.issuingBody,
      category: input.category,
      registration_date: input.registrationDate,
      expiration_date: input.expirationDate,
      notes: input.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) {
    if (isInvalidInput(error)) return undefined;
    fail("update the certificate", error);
  }
  return data ? rowToCertificate(data as CertificateRow) : undefined;
}

export async function deleteCertificate(id: string): Promise<boolean> {
  await ensureSeeded();
  const { data, error } = await getSupabase()
    .from("certificates")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) {
    if (isInvalidInput(error)) return false;
    fail("delete the certificate", error);
  }
  return (data ?? []).length > 0;
}

// --- Vessel watchlist ---------------------------------------------------------

export async function listWatchlist(): Promise<Vessel[]> {
  await ensureSeeded();
  const { data, error } = await getSupabase()
    .from("watchlist")
    .select("vessel")
    .order("added_at", { ascending: true });
  if (error) fail("load the watchlist", error);
  return (data ?? []).map((row) => row.vessel as Vessel);
}

/** Add a vessel, or refresh the stored snapshot when it is already listed. */
export async function addToWatchlist(vessel: Vessel): Promise<Vessel[]> {
  await ensureSeeded();
  const { error } = await getSupabase()
    .from("watchlist")
    .upsert(
      { mmsi: vessel.mmsi, vessel, updated_at: new Date().toISOString() },
      { onConflict: "mmsi" }
    );
  if (error) fail("update the watchlist", error);
  return listWatchlist();
}

export async function removeFromWatchlist(mmsi: string): Promise<Vessel[]> {
  await ensureSeeded();
  const { error } = await getSupabase()
    .from("watchlist")
    .delete()
    .eq("mmsi", mmsi);
  if (error) fail("update the watchlist", error);
  return listWatchlist();
}
