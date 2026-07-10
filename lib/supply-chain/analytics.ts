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
        "id, vendor_id, buyer_id, status, procurement_method, budgeted_cost, final_cost, cost_savings, end_date, actual_completion_date, nigerian_content_percentage"
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
    budgeted_cost: number;
    final_cost: number | null;
    cost_savings: number | null;
    end_date: string;
    actual_completion_date: string | null;
    nigerian_content_percentage: number | null;
  };
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

  // Spend + savings (savings only exist once a final cost is recorded).
  let totalSavings = 0;
  let totalBudgeted = 0;
  let totalFinal = 0;
  for (const p of rows) {
    totalBudgeted += p.budgeted_cost;
    if (p.final_cost !== null) {
      totalFinal += p.final_cost;
      totalSavings += p.cost_savings ?? 0;
    }
  }

  // Savings trend by month, keyed on actual completion (falling back to the
  // planned end date), last 6 months with any savings.
  const byMonth = new Map<string, { label: string; savings: number }>();
  for (const p of rows) {
    if (p.cost_savings === null) continue;
    const d = parseISO(p.actual_completion_date ?? p.end_date);
    const key = format(d, "yyyy-MM");
    const entry = byMonth.get(key) ?? { label: format(d, "MMM yyyy"), savings: 0 };
    entry.savings += p.cost_savings;
    byMonth.set(key, entry);
  }
  const savingsByMonth = Array.from(byMonth.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([, v]) => ({ month: v.label, savings: v.savings }));

  // Top 3 buyers by summed savings.
  const buyerAgg = new Map<string, { totalSavings: number; projectCount: number }>();
  for (const p of rows) {
    const agg = buyerAgg.get(p.buyer_id) ?? { totalSavings: 0, projectCount: 0 };
    agg.projectCount += 1;
    if (p.cost_savings !== null) agg.totalSavings += p.cost_savings;
    buyerAgg.set(p.buyer_id, agg);
  }
  const topBuyers = Array.from(buyerAgg.entries())
    .map(([id, agg]) => ({
      id,
      name: buyerNames.get(id) ?? "Unknown buyer",
      ...agg,
    }))
    .sort((a, b) => b.totalSavings - a.totalSavings)
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
  const methodAgg = new Map<ProcurementMethod, { count: number; budgeted: number }>();
  for (const p of rows) {
    const agg = methodAgg.get(p.procurement_method) ?? { count: 0, budgeted: 0 };
    agg.count += 1;
    agg.budgeted += p.budgeted_cost;
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
  const vendorAgg = new Map<string, { projectCount: number; totalValue: number }>();
  for (const p of rows) {
    if (!p.vendor_id) continue;
    const agg = vendorAgg.get(p.vendor_id) ?? { projectCount: 0, totalValue: 0 };
    agg.projectCount += 1;
    agg.totalValue += p.final_cost ?? p.budgeted_cost;
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
