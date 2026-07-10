/**
 * Pure derivation logic for the supply chain module — safe to import from
 * both server (data layer) and client (badges, formatting) code.
 */
import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Vendor, VendorDocumentStatus } from "@/types";

/** Days before expiry within which a document counts as "Expiring Soon". */
export const DOC_EXPIRY_WINDOW_DAYS = 30;

/** Nigerian equity at or above this marks an indigenous company (NOGICD). */
export const INDIGENOUS_EQUITY_THRESHOLD = 51;

/** Projects below this Nigerian content percentage get a compliance flag. */
export const NIGERIAN_CONTENT_TARGET = 50;

export function documentStatus(
  expiryDate: string | null | undefined,
  now: Date = new Date()
): { status: VendorDocumentStatus; daysToExpiry?: number } {
  if (!expiryDate) return { status: "Valid" }; // non-expiring document
  const days = differenceInCalendarDays(parseISO(expiryDate), now);
  if (days < 0) return { status: "Expired", daysToExpiry: days };
  if (days <= DOC_EXPIRY_WINDOW_DAYS)
    return { status: "Expiring Soon", daysToExpiry: days };
  return { status: "Valid", daysToExpiry: days };
}

/**
 * Overall confidence rating (0–5): the manual override when set, otherwise a
 * weighted average of the sub-scores that have been filled in (weights are
 * renormalised over the present scores). Undefined until something is scored.
 */
export function confidenceRating(
  v: Pick<
    Vendor,
    | "deliveryScore"
    | "qualityScore"
    | "hseScore"
    | "complianceScore"
    | "confidenceOverride"
  >
): number | undefined {
  if (v.confidenceOverride !== undefined && v.confidenceOverride !== null) {
    return round1(v.confidenceOverride);
  }
  const parts: Array<[number | undefined, number]> = [
    [v.deliveryScore, 0.3],
    [v.qualityScore, 0.3],
    [v.hseScore, 0.2],
    [v.complianceScore, 0.2],
  ];
  let sum = 0;
  let weight = 0;
  for (const [score, w] of parts) {
    if (score !== undefined && score !== null) {
      sum += score * w;
      weight += w;
    }
  }
  if (weight === 0) return undefined;
  return round1(sum / weight);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

const nairaFormat = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
});

const usdFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatNaira(amount: number): string {
  return nairaFormat.format(amount);
}

export function formatMoney(amount: number, currency: "NGN" | "USD"): string {
  return currency === "USD" ? usdFormat.format(amount) : nairaFormat.format(amount);
}

/** Compact ₦ for chart axes and stat tiles, e.g. ₦2.4M, ₦180K. */
export function formatNairaCompact(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `₦${(amount / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₦${(amount / 1_000).toFixed(0)}K`;
  return nairaFormat.format(amount);
}
