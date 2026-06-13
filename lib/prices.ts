/**
 * Brent crude price data layer.
 *
 * Live source: U.S. EIA Open Data API v2, petroleum spot prices, series RBRTE
 * (Europe Brent spot price FOB, daily). Requires EIA_API_KEY.
 * Docs: https://www.eia.gov/opendata/
 *
 * Falls back to a deterministic mock series when no key is set or the request
 * fails, so the price and forecast features always work.
 */
import type { PricePoint, PriceSeries } from "@/types";
import { getCached, setCached } from "@/lib/cache";
import { mockPriceSeries } from "@/lib/mock-data";

const EIA_BASE = "https://api.eia.gov/v2/petroleum/pri/spt/data/";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour, per the rate-limit guidance.
const MAX_DAYS = 370; // Enough for the 1-year range plus a margin.

interface EiaRow {
  period: string;
  value: string | number | null;
}

async function fetchEiaBrent(apiKey: string): Promise<PricePoint[]> {
  const url = new URL(EIA_BASE);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("frequency", "daily");
  url.searchParams.append("data[0]", "value");
  url.searchParams.append("facets[series][]", "RBRTE");
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("offset", "0");
  url.searchParams.set("length", String(MAX_DAYS));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`EIA responded ${res.status}`);
    const json = (await res.json()) as {
      response?: { data?: EiaRow[] };
    };
    const rows = json.response?.data ?? [];
    const points: PricePoint[] = rows
      .map((r) => ({
        date: r.period,
        price: typeof r.value === "string" ? parseFloat(r.value) : r.value ?? NaN,
      }))
      .filter((p) => Number.isFinite(p.price))
      // API returns newest-first; chart wants oldest-first.
      .reverse();
    if (points.length === 0) throw new Error("EIA returned no usable rows");
    return points;
  } finally {
    clearTimeout(timeout);
  }
}

/** Build summary stats and current/previous from a point list. */
function summarise(
  points: PricePoint[],
  label: string,
  isMock: boolean
): PriceSeries {
  const prices = points.map((p) => p.price);
  const current = prices[prices.length - 1] ?? 0;
  const previous = prices[prices.length - 2] ?? current;
  const change = current - previous;
  const changePercent = previous ? (change / previous) * 100 : 0;
  const high = prices.length ? Math.max(...prices) : 0;
  const low = prices.length ? Math.min(...prices) : 0;
  const average =
    prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
  const variance =
    prices.length
      ? prices.reduce((a, b) => a + (b - average) ** 2, 0) / prices.length
      : 0;
  const volatility = Math.sqrt(variance);
  return {
    label,
    points,
    current: round(current),
    previous: round(previous),
    change: round(change),
    changePercent: round(changePercent),
    high: round(high),
    low: round(low),
    average: round(average),
    volatility: round(volatility),
    isMock,
    fetchedAt: new Date().toISOString(),
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Return the full Brent series (up to ~1 year), cached for 1 hour.
 * Callers slice to the range they need.
 */
export async function getBrentSeries(): Promise<PriceSeries> {
  const cacheKey = "brent-full";
  const cached = getCached<PriceSeries>(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.EIA_API_KEY?.trim();
  const label = "Brent Crude (Europe Spot, FOB)";

  let result: PriceSeries;
  if (apiKey) {
    try {
      const points = await fetchEiaBrent(apiKey);
      result = summarise(points, label, false);
    } catch {
      result = summarise(mockPriceSeries(MAX_DAYS), label, true);
    }
  } else {
    result = summarise(mockPriceSeries(MAX_DAYS), label, true);
  }

  setCached(cacheKey, result, CACHE_TTL_MS);
  return result;
}

/** Slice a series to the last N days and recompute window stats. */
export function sliceSeries(series: PriceSeries, days: number): PriceSeries {
  const points = series.points.slice(-days);
  const sliced = summarise(points, series.label, series.isMock);
  // Preserve the original fetch time.
  sliced.fetchedAt = series.fetchedAt;
  return sliced;
}
