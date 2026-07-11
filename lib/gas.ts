/**
 * Gas pricing data layer (Supabase).
 *
 * Serves the three global benchmark series (Henry Hub, TTF, JKM) and the
 * Nigeria PIA regulated prices. Both tables are seeded on first touch from
 * lib/gas-seed.ts so the page works out of the box; after that the rows in
 * Supabase are the source of truth — edit them there (e.g. each year's new
 * NMDPRA prices) and the page follows.
 */
import type { GasBenchmarkKey, GasData, PiaGasPrice, PricePoint } from "@/types";
import { getSupabase } from "@/lib/supabase";
import { StoreError } from "@/lib/store";
import { getCached, setCached } from "@/lib/cache";
import { seedPiaRows, seedPriceSeriesRows } from "@/lib/gas-seed";

const CACHE_KEY = "gas:data";
const CACHE_TTL_MS = 60 * 60 * 1000; // matches the Brent cache policy

function fail(action: string, error: { code?: string; message?: string }): never {
  if (error.code === "PGRST205" || /schema cache/i.test(error.message ?? "")) {
    throw new StoreError(
      "Gas tables are missing. Run supabase/gas-schema.sql in the Supabase SQL editor, then try again."
    );
  }
  throw new StoreError(
    `Failed to ${action}. (${error.message ?? "unknown database error"})`
  );
}

const g = globalThis as unknown as { __gasSeeded?: boolean };

/** Seed both tables when empty (first run). Editable thereafter. */
async function ensureSeeded(): Promise<void> {
  if (g.__gasSeeded) return;
  const sb = getSupabase();

  const series = await sb
    .from("price_series")
    .select("id", { count: "exact", head: true });
  if (series.error) fail("initialise gas price data", series.error);
  if ((series.count ?? 0) === 0) {
    const { error } = await sb.from("price_series").upsert(seedPriceSeriesRows(), {
      onConflict: "series_name,date",
      ignoreDuplicates: true,
    });
    if (error) fail("seed the benchmark price history", error);
  }

  const pia = await sb
    .from("pia_gas_price")
    .select("id", { count: "exact", head: true });
  if (pia.error) fail("initialise PIA price data", pia.error);
  if ((pia.count ?? 0) === 0) {
    const { error } = await sb.from("pia_gas_price").upsert(seedPiaRows(), {
      onConflict: "effective_date,sector",
      ignoreDuplicates: true,
    });
    if (error) fail("seed the PIA reference prices", error);
  }

  g.__gasSeeded = true;
}

export async function getGasData(): Promise<GasData> {
  const cached = getCached<GasData>(CACHE_KEY);
  if (cached) return cached;

  await ensureSeeded();
  const sb = getSupabase();

  const [series, pia] = await Promise.all([
    sb
      .from("price_series")
      .select("series_name, date, price")
      .order("date", { ascending: true }),
    sb
      .from("pia_gas_price")
      .select("*")
      .order("effective_date", { ascending: true }),
  ]);
  if (series.error) fail("load the gas benchmark series", series.error);
  if (pia.error) fail("load the PIA prices", pia.error);

  const buckets: Record<GasBenchmarkKey, PricePoint[]> = {
    henry_hub: [],
    ttf: [],
    jkm: [],
  };
  for (const row of series.data as Array<{
    series_name: string;
    date: string;
    price: number;
  }>) {
    const key = row.series_name as GasBenchmarkKey;
    if (buckets[key]) buckets[key].push({ date: row.date, price: row.price });
  }

  const result: GasData = {
    series: buckets,
    pia: (pia.data ?? []).map(
      (row): PiaGasPrice => ({
        id: row.id,
        effectiveDate: row.effective_date,
        sector: row.sector,
        priceUsdMmbtu: row.price_usd_mmbtu,
        floorUsdMmbtu: row.floor_usd_mmbtu ?? undefined,
      })
    ),
    fetchedAt: new Date().toISOString(),
  };

  setCached(CACHE_KEY, result, CACHE_TTL_MS);
  return result;
}
