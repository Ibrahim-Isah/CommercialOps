/**
 * Supply chain dashboard aggregates. Everything is computed from live rows
 * in four queries; at this scale JS aggregation keeps the logic in one place
 * and guarantees the numbers reconcile with the list pages (same definitions:
 * savings = budgeted − final, only when a final cost exists).
 */
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { getSupabase } from "@/lib/supabase";
import { fail } from "@/lib/supply-chain/common";
import { documentStatus } from "@/lib/supply-chain/derive";
import type {
  ProcurementMethod,
  SupplyChainAnalytics,
  SupplyProjectStatus,
  VendorDocumentType,
} from "@/types";

const ALL_STATUSES: SupplyProjectStatus[] = [
  "ongoing",
  "completed",
  "cancelled",
  "delayed",
  "expired",
];

export async function getSupplyChainAnalytics(): Promise<SupplyChainAnalytics> {
  const sb = getSupabase();
  const [projects, vendors, documents, buyers] = await Promise.all([
    sb
      .from("projects")
      .select(
        "id, vendor_id, buyer_id, status, procurement_method, budgeted_cost_ngn, final_cost_ngn, cost_savings_ngn, budgeted_cost_usd, final_cost_usd, cost_savings_usd, end_date, actual_completion_date, nigerian_content_percentage"
      ),
    sb.from("vendors").select("id, name, status"),
    sb
      .from("vendor_documents")
      .select("vendor_id, document_name, document_type, expiry_date"),
    sb.from("buyers").select("id, full_name"),
  ]);
  if (projects.error) fail("load projects for analytics", projects.error);
  if (vendors.error) fail("load vendors for analytics", vendors.error);
  if (documents.error) fail("load documents for analytics", documents.error);
  if (buyers.error) fail("load buyers for analytics", buyers.error);

  type P = {
    id: string;
    vendor_id: string | null;
    buyer_id: string;
    status: SupplyProjectStatus;
    procurement_method: ProcurementMethod;
    budgeted_cost_ngn: number | null;
    final_cost_ngn: number | null;
    cost_savings_ngn: number | null;
    budgeted_cost_usd: number | null;
    final_cost_usd: number | null;
    cost_savings_usd: number | null;
    end_date: string;
    actual_completion_date: string | null;
    nigerian_content_percentage: number | null;
  };
  /** Has either currency recorded any savings yet? */
  const hasSavings = (p: P) =>
    p.cost_savings_ngn !== null || p.cost_savings_usd !== null;
  const rows = projects.data as P[];
  const vendorList = vendors.data as Array<{
    id: string;
    name: string;
    status: string;
  }>;
  const buyerNames = new Map(
    (buyers.data as Array<{ id: string; full_name: string }>).map((b) => [
      b.id,
      b.full_name,
    ])
  );
  const vendorNames = new Map(vendorList.map((v) => [v.id, v.name]));

  // Status counts.
  const statusCounts = Object.fromEntries(
    ALL_STATUSES.map((s) => [s, 0])
  ) as Record<SupplyProjectStatus, number>;
  for (const p of rows) statusCounts[p.status] += 1;

  // Spend + savings per currency (savings only exist once that currency has a
  // final cost). ₦ and $ are never summed together — the app holds no FX rate.
  const totalSavings = { ngn: 0, usd: 0 };
  const totalBudgeted = { ngn: 0, usd: 0 };
  const totalFinal = { ngn: 0, usd: 0 };
  for (const p of rows) {
    totalBudgeted.ngn += p.budgeted_cost_ngn ?? 0;
    totalBudgeted.usd += p.budgeted_cost_usd ?? 0;
    if (p.final_cost_ngn !== null) {
      totalFinal.ngn += p.final_cost_ngn;
      totalSavings.ngn += p.cost_savings_ngn ?? 0;
    }
    if (p.final_cost_usd !== null) {
      totalFinal.usd += p.final_cost_usd;
      totalSavings.usd += p.cost_savings_usd ?? 0;
    }
  }

  // Savings trend by month, keyed on actual completion (falling back to the
  // planned end date), last 6 months with any savings.
  const byMonth = new Map<string, { label: string; ngn: number; usd: number }>();
  for (const p of rows) {
    if (!hasSavings(p)) continue;
    const d = parseISO(p.actual_completion_date ?? p.end_date);
    const key = format(d, "yyyy-MM");
    const entry =
      byMonth.get(key) ?? { label: format(d, "MMM yyyy"), ngn: 0, usd: 0 };
    entry.ngn += p.cost_savings_ngn ?? 0;
    entry.usd += p.cost_savings_usd ?? 0;
    byMonth.set(key, entry);
  }
  const savingsByMonth = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, v]) => ({ month: v.label, ngn: v.ngn, usd: v.usd }));

  // Top 3 buyers by summed savings. Ranked on ₦ (the primary book currency)
  // with $ as the tiebreak, since the two cannot be combined without a rate.
  const buyerAgg = new Map<
    string,
    { savingsNgn: number; savingsUsd: number; projectCount: number }
  >();
  for (const p of rows) {
    const agg =
      buyerAgg.get(p.buyer_id) ?? { savingsNgn: 0, savingsUsd: 0, projectCount: 0 };
    agg.projectCount += 1;
    agg.savingsNgn += p.cost_savings_ngn ?? 0;
    agg.savingsUsd += p.cost_savings_usd ?? 0;
    buyerAgg.set(p.buyer_id, agg);
  }
  const topBuyers = Array.from(buyerAgg.entries())
    .map(([id, agg]) => ({
      id,
      name: buyerNames.get(id) ?? "Unknown buyer",
      ...agg,
    }))
    .sort((a, b) => b.savingsNgn - a.savingsNgn || b.savingsUsd - a.savingsUsd)
    .slice(0, 3);

  // Vendor snapshot + compliance alerts (expired or expiring within 30 days).
  const vendorsWithExpired = new Set<string>();
  const vendorsWithExpiring = new Set<string>();
  const complianceAlerts: SupplyChainAnalytics["complianceAlerts"] = [];
  for (const d of documents.data as Array<{
    vendor_id: string;
    document_name: string;
    document_type: VendorDocumentType;
    expiry_date: string | null;
  }>) {
    const { status } = documentStatus(d.expiry_date);
    if (status === "Valid") continue;
    if (status === "Expired") vendorsWithExpired.add(d.vendor_id);
    if (status === "Expiring Soon") vendorsWithExpiring.add(d.vendor_id);
    complianceAlerts.push({
      vendorId: d.vendor_id,
      vendorName: vendorNames.get(d.vendor_id) ?? "Unknown vendor",
      documentName: d.document_name,
      documentType: d.document_type,
      expiryDate: d.expiry_date as string,
      status,
      daysToExpiry: differenceInCalendarDays(
        parseISO(d.expiry_date as string),
        new Date()
      ),
    });
  }
  complianceAlerts.sort((a, b) => a.daysToExpiry - b.daysToExpiry);

  // Procurement method breakdown (single-source share is a governance signal).
  const methodAgg = new Map<
    ProcurementMethod,
    { count: number; budgeted: { ngn: number; usd: number } }
  >();
  for (const p of rows) {
    const agg =
      methodAgg.get(p.procurement_method) ??
      { count: 0, budgeted: { ngn: 0, usd: 0 } };
    agg.count += 1;
    agg.budgeted.ngn += p.budgeted_cost_ngn ?? 0;
    agg.budgeted.usd += p.budgeted_cost_usd ?? 0;
    methodAgg.set(p.procurement_method, agg);
  }
  const methodBreakdown = Array.from(methodAgg.entries())
    .map(([method, agg]) => ({ method, ...agg }))
    .sort((a, b) => b.count - a.count);

  // Average Nigerian content across active (ongoing/delayed) projects.
  const activeNC = rows
    .filter(
      (p) =>
        (p.status === "ongoing" || p.status === "delayed") &&
        p.nigerian_content_percentage !== null
    )
    .map((p) => p.nigerian_content_percentage as number);
  const avgNigerianContent =
    activeNC.length > 0
      ? Math.round(
          (activeNC.reduce((a, b) => a + b, 0) / activeNC.length) * 10
        ) / 10
      : null;

  // Top vendors by project count.
  const vendorAgg = new Map<
    string,
    { projectCount: number; totalValue: { ngn: number; usd: number } }
  >();
  for (const p of rows) {
    if (!p.vendor_id) continue;
    const agg =
      vendorAgg.get(p.vendor_id) ??
      { projectCount: 0, totalValue: { ngn: 0, usd: 0 } };
    agg.projectCount += 1;
    agg.totalValue.ngn += p.final_cost_ngn ?? p.budgeted_cost_ngn ?? 0;
    agg.totalValue.usd += p.final_cost_usd ?? p.budgeted_cost_usd ?? 0;
    vendorAgg.set(p.vendor_id, agg);
  }
  const topVendors = Array.from(vendorAgg.entries())
    .map(([id, agg]) => ({
      id,
      name: vendorNames.get(id) ?? "Unknown vendor",
      ...agg,
    }))
    .sort((a, b) => b.projectCount - a.projectCount)
    .slice(0, 5);

  // Timeliness: completed on time vs late, plus ongoing work already past due.
  let onTime = 0;
  let late = 0;
  let pastDueOngoing = 0;
  const today = new Date();
  for (const p of rows) {
    if (p.status === "completed" && p.actual_completion_date) {
      if (
        differenceInCalendarDays(
          parseISO(p.actual_completion_date),
          parseISO(p.end_date)
        ) <= 0
      ) {
        onTime += 1;
      } else {
        late += 1;
      }
    } else if (
      (p.status === "ongoing" || p.status === "delayed") &&
      differenceInCalendarDays(parseISO(p.end_date), today) < 0
    ) {
      pastDueOngoing += 1;
    }
  }

  return {
    statusCounts,
    totalProjects: rows.length,
    totalSavings,
    totalBudgeted,
    totalFinal,
    savingsByMonth,
    topBuyers,
    vendorSnapshot: {
      total: vendorList.length,
      active: vendorList.filter((v) => v.status === "active").length,
      withExpiredDocs: vendorsWithExpired.size,
      withExpiringDocs: vendorsWithExpiring.size,
    },
    methodBreakdown,
    avgNigerianContent,
    topVendors,
    complianceAlerts: complianceAlerts.slice(0, 10),
    timeliness: { onTime, late, pastDueOngoing },
  };
}
