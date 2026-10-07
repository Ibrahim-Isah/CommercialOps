/**
 * Monitoring & reporting aggregates for the grievance mechanism (§6.8):
 * the KPIs management reviews quarterly — volumes by level and type, open vs
 * resolved, rapid-response resolutions, and trend analysis by month.
 */
import { parseISO, format, differenceInCalendarDays } from "date-fns";
import { listGrievances } from "@/lib/grievance/grievances";
import { decorate, isSettled } from "@/lib/grievance/derive";
import type {
  Grievance,
  GrievanceAnalytics,
  GrievanceCategory,
  GrievanceNature,
  GrievanceSeverity,
  GrievanceStatus,
  GrievanceArea,
} from "@/types";

const SEVERITIES: GrievanceSeverity[] = ["Low", "Medium", "High"];
const STATUSES: GrievanceStatus[] = ["Open", "Resolved", "Closed", "Abandoned"];

/** Months with activity over the last 12 months, oldest first. */
function monthKeys(since: Date): string[] {
  const keys: string[] = [];
  const cursor = new Date(since.getFullYear(), since.getMonth(), 1);
  const end = new Date();
  while (cursor <= end) {
    keys.push(format(cursor, "yyyy-MM"));
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return keys;
}

export async function getGrievanceAnalytics(): Promise<GrievanceAnalytics> {
  const grievances = await listGrievances();
  const enriched = decorate(grievances);

  const statusCounts = Object.fromEntries(
    STATUSES.map((s) => [s, 0])
  ) as Record<GrievanceStatus, number>;
  const severityCounts = Object.fromEntries(
    SEVERITIES.map((s) => [s, 0])
  ) as Record<GrievanceSeverity, number>;

  const categoryAgg = new Map<
    GrievanceCategory,
    { total: number; open: number; resolved: number }
  >();
  const natureAgg = new Map<GrievanceNature, number>();
  const areaAgg = new Map<GrievanceArea, { total: number; open: number }>();

  let openHighSeverity = 0;
  let overdue = 0;
  let rapidResponseCount = 0;
  let litigationCount = 0;
  const resolutionDays: number[] = [];

  for (const g of enriched) {
    statusCounts[g.status] += 1;
    severityCounts[g.severity] += 1;

    const cat =
      categoryAgg.get(g.category) ?? { total: 0, open: 0, resolved: 0 };
    cat.total += 1;
    if (isSettled(g)) cat.resolved += 1;
    else cat.open += 1;
    categoryAgg.set(g.category, cat);

    natureAgg.set(g.nature, (natureAgg.get(g.nature) ?? 0) + 1);

    const area = areaAgg.get(g.area) ?? { total: 0, open: 0 };
    area.total += 1;
    if (!isSettled(g)) area.open += 1;
    areaAgg.set(g.area, area);

    if (!isSettled(g) && g.severity === "High") openHighSeverity += 1;
    if (g.overdue) overdue += 1;
    if (g.rapidResponse) rapidResponseCount += 1;
    if (g.litigation) litigationCount += 1;
    if (g.resolvedDate) {
      resolutionDays.push(
        differenceInCalendarDays(parseISO(g.resolvedDate), parseISO(g.dateReceived))
      );
    }
  }

  // Trend analysis: received vs resolved per month (§6.8 review KPIs).
  const since = new Date();
  since.setMonth(since.getMonth() - 11);
  since.setDate(1);
  const monthly = monthKeys(since).map((month) => ({
    month,
    received: 0,
    resolved: 0,
  }));
  const byMonth = new Map(monthly.map((m) => [m.month, m]));
  for (const g of grievances) {
    const receivedKey = format(parseISO(g.dateReceived), "yyyy-MM");
    const receivedRow = byMonth.get(receivedKey);
    if (receivedRow) receivedRow.received += 1;
    if (g.resolvedDate) {
      const resolvedKey = format(parseISO(g.resolvedDate), "yyyy-MM");
      const resolvedRow = byMonth.get(resolvedKey);
      if (resolvedRow) resolvedRow.resolved += 1;
    }
  }

  return {
    total: grievances.length,
    statusCounts,
    severityCounts,
    openHighSeverity,
    overdue,
    rapidResponseCount,
    litigationCount,
    avgDaysToResolution:
      resolutionDays.length > 0
        ? Math.round(
            resolutionDays.reduce((a, b) => a + b, 0) / resolutionDays.length
          )
        : null,
    byCategory: Array.from(categoryAgg.entries())
      .map(([category, agg]) => ({ category, ...agg }))
      .sort((a, b) => b.total - a.total),
    byNature: Array.from(natureAgg.entries())
      .map(([nature, total]) => ({ nature, total }))
      .sort((a, b) => b.total - a.total),
    byArea: Array.from(areaAgg.entries()).map(([area, agg]) => ({ area, ...agg })),
    monthly,
  };
}
