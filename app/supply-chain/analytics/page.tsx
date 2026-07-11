"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Building2,
  PiggyBank,
  Trophy,
} from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DocumentStatusBadge } from "@/components/supply-chain/badges";
import { DualMoney } from "@/components/supply-chain/dual-money";
import {
  formatNaira,
  formatNairaCompact,
  formatPairCompact,
  formatUsd,
  NIGERIAN_CONTENT_TARGET,
} from "@/lib/supply-chain/derive";
import type { SupplyChainAnalytics, SupplyProjectStatus } from "@/types";

const STATUS_CARDS: Array<{ status: SupplyProjectStatus; label: string }> = [
  { status: "ongoing", label: "Ongoing" },
  { status: "completed", label: "Completed" },
  { status: "cancelled", label: "Cancelled" },
  { status: "delayed", label: "Delayed" },
  { status: "expired", label: "Expired" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <CardTitle className="text-sm font-medium text-muted-foreground">
      {children}
    </CardTitle>
  );
}

export default function SupplyChainAnalyticsPage() {
  const [analytics, setAnalytics] = React.useState<SupplyChainAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/supply-chain/analytics", {
        cache: "no-store",
      });
      const data = (await res.json()) as {
        analytics?: SupplyChainAnalytics;
        error?: string;
      };
      if (!res.ok || !data.analytics) throw new Error(data.error);
      setAnalytics(data.analytics);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Could not load supply chain analytics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Supply Chain Analytics"
          description="Procurement performance at a glance."
        />
        <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div>
        <PageHeader
          title="Supply Chain Analytics"
          description="Procurement performance at a glance."
        />
        <ErrorState message={error ?? undefined} onRetry={() => void load()} />
      </div>
    );
  }

  const a = analytics;
  const hasProjects = a.totalProjects > 0;
  const singleSourceShare =
    a.totalProjects > 0
      ? Math.round(
          ((a.methodBreakdown.find((m) => m.method === "single source")?.count ??
            0) /
            a.totalProjects) *
            100
        )
      : 0;
  const maxMethodCount = Math.max(1, ...a.methodBreakdown.map((m) => m.count));

  return (
    <div>
      <PageHeader
        title="Supply Chain Analytics"
        description="Procurement performance at a glance. Click a status card to see those projects."
      />

      {/* Project status counts — deep link into the filtered Projects page. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_CARDS.map(({ status, label }) => (
          <Link key={status} href={`/supply-chain/projects?status=${status}`}>
            <Card className="transition-colors hover:bg-secondary/40">
              <CardContent className="pt-6">
                <p className="text-3xl font-bold">{a.statusCounts[status]}</p>
                <p className="text-sm text-muted-foreground">{label} projects</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Compliance strip — the most valuable safeguard. */}
      {a.complianceAlerts.length > 0 && (
        <Card className="mb-6 border-warning/60">
          <CardHeader className="pb-2">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Compliance — vendor documents needing attention
              </span>
            </SectionTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {a.complianceAlerts.map((alert, i) => (
                <li
                  key={`${alert.vendorId}-${alert.documentName}-${i}`}
                  className="flex flex-wrap items-center gap-2 py-2 text-sm"
                >
                  <Link
                    href={`/supply-chain/vendors/${alert.vendorId}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {alert.vendorName}
                  </Link>
                  <span className="text-muted-foreground">
                    {alert.documentName} ({alert.documentType})
                  </span>
                  <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    {format(parseISO(alert.expiryDate), "d MMM yyyy")}
                    <DocumentStatusBadge status={alert.status} className="text-[10px]" />
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Cost savings + spend overview */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <PiggyBank className="h-4 w-4" />
                Cost savings
              </span>
            </SectionTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {formatNaira(a.totalSavings.ngn)}
              {a.totalSavings.usd !== 0 && (
                <span className="ml-2 text-xl font-semibold text-muted-foreground">
                  + {formatUsd(a.totalSavings.usd)}
                </span>
              )}
            </p>
            <p className="mb-4 text-sm text-muted-foreground">
              total savings across all projects with a final cost, per currency
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Total budgeted</p>
                <p className="text-lg font-semibold">
                  {formatPairCompact(a.totalBudgeted)}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Total final</p>
                <p className="text-lg font-semibold">
                  {formatPairCompact(a.totalFinal)}
                </p>
              </div>
            </div>
            {a.savingsByMonth.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={a.savingsByMonth}
                  margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatNairaCompact(v)}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                  />
                  <Tooltip
                    // The bars plot ₦ (the primary book currency); any $
                    // savings in the same month ride along in the tooltip.
                    formatter={(v, _name, item) => {
                      const usd = (item?.payload as { usd?: number })?.usd ?? 0;
                      return [
                        formatNaira(Number(v)) +
                          (usd !== 0 ? ` + ${formatUsd(usd)}` : ""),
                        "Savings",
                      ];
                    }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.5rem",
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="ngn"
                    fill="hsl(var(--accent))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={36}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">
                Savings by month appears once completed projects record final
                costs.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top 3 buyers */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Top buyers by cost savings
              </span>
            </SectionTitle>
          </CardHeader>
          <CardContent>
            {a.topBuyers.length === 0 ? (
              <EmptyState message="No buyers with projects yet." />
            ) : (
              <ol className="space-y-3">
                {a.topBuyers.map((b, i) => (
                  <li
                    key={b.id}
                    className="flex items-center gap-3 rounded-md border p-3"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{b.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.projectCount} project{b.projectCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <DualMoney
                      ngn={b.savingsNgn}
                      usd={b.savingsUsd !== 0 ? b.savingsUsd : undefined}
                      signed
                      className="shrink-0 items-end text-sm font-semibold"
                    />
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        {/* Procurement method breakdown */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <SectionTitle>Projects by procurement method</SectionTitle>
          </CardHeader>
          <CardContent>
            {!hasProjects ? (
              <EmptyState message="No projects yet." />
            ) : (
              <div className="space-y-3">
                {a.methodBreakdown.map((m) => (
                  <div key={m.method}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-medium capitalize">{m.method}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.count} · {formatPairCompact(m.budgeted)} budgeted
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${(m.count / maxMethodCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
                {singleSourceShare > 25 && (
                  <p className="flex items-center gap-2 pt-1 text-xs text-warning">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {singleSourceShare}% of projects are single source — worth a
                    governance review.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Vendor snapshot + Nigerian content + timeliness */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <SectionTitle>
              <span className="inline-flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Vendor & compliance snapshot
              </span>
            </SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Active vendors</p>
                <p className="text-lg font-semibold">
                  {a.vendorSnapshot.active}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    of {a.vendorSnapshot.total}
                  </span>
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Document risk</p>
                <p className="text-lg font-semibold">
                  {a.vendorSnapshot.withExpiredDocs + a.vendorSnapshot.withExpiringDocs}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    vendors
                  </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {a.vendorSnapshot.withExpiredDocs} expired ·{" "}
                  {a.vendorSnapshot.withExpiringDocs} expiring
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">
                  Avg Nigerian content
                </p>
                <p className="text-lg font-semibold">
                  {a.avgNigerianContent !== null ? `${a.avgNigerianContent}%` : "—"}
                </p>
                {a.avgNigerianContent !== null && (
                  <Badge
                    variant={
                      a.avgNigerianContent >= NIGERIAN_CONTENT_TARGET
                        ? "success"
                        : "warning"
                    }
                    className="mt-1 text-[10px]"
                  >
                    target {NIGERIAN_CONTENT_TARGET}%
                  </Badge>
                )}
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">On-time completion</p>
                <p className="text-lg font-semibold">
                  {a.timeliness.onTime + a.timeliness.late > 0
                    ? `${a.timeliness.onTime} / ${a.timeliness.onTime + a.timeliness.late}`
                    : "—"}
                </p>
                {a.timeliness.pastDueOngoing > 0 && (
                  <p className="text-[11px] text-warning">
                    {a.timeliness.pastDueOngoing} ongoing past due
                  </p>
                )}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Top vendors by project count
              </p>
              {a.topVendors.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No vendors with projects yet.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {a.topVendors.map((v) => (
                    <li key={v.id} className="flex items-center gap-2 text-sm">
                      <Link
                        href={`/supply-chain/vendors/${v.id}`}
                        className="min-w-0 flex-1 truncate hover:text-accent hover:underline"
                      >
                        {v.name}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {v.projectCount} · {formatPairCompact(v.totalValue)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
