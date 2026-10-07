"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Gavel,
  Inbox,
  Siren,
  Timer,
  Zap,
} from "lucide-react";
import { PageHeader, ErrorState } from "@/components/common";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CategoryChart,
  MonthlyTrendChart,
  SeverityChart,
} from "@/components/charts/grievance-charts";
import type { GrievanceAnalytics } from "@/types";

function StatTile({
  label,
  value,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "default" | "warning" | "destructive" | "success";
  hint?: string;
}) {
  const tones = {
    default: "text-foreground",
    warning: "text-warning",
    destructive: "text-destructive",
    success: "text-success",
  } as const;
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${tones[tone]}`}>
            {value}
          </p>
          {hint && (
            <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
          )}
        </div>
        <div className="shrink-0 text-muted-foreground">{icon}</div>
      </CardContent>
    </Card>
  );
}

/**
 * Monitoring & Reporting (§6.8): the KPI set management reviews quarterly —
 * volumes by level and type, open vs resolved, rapid-response resolutions,
 * recurring themes, and the month-by-month trend analysis.
 */
export default function GrievanceAnalyticsPage() {
  const [analytics, setAnalytics] = React.useState<GrievanceAnalytics | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/grievances/analytics", { cache: "no-store" });
      const data = (await res.json()) as {
        analytics?: GrievanceAnalytics;
        error?: string;
      };
      if (!res.ok || !data.analytics) throw new Error(data.error);
      setAnalytics(data.analytics);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Could not load analytics."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Monitoring & Reporting"
        description="Quarterly review KPIs for the grievance mechanism (§6.8): volumes, status, rapid-response resolutions and trends."
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : !analytics || analytics.total === 0 ? (
        <ErrorState
          message="No grievances registered yet — analytics appear once the register has cases."
          onRetry={() => void load()}
        />
      ) : (
        <div className="space-y-4">
          {/* KPI row (§6.8 review KPIs a–d) */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Total grievances received"
              value={analytics.total}
              icon={<Inbox className="h-6 w-6" />}
            />
            <StatTile
              label="Open grievances"
              value={analytics.statusCounts.Open}
              icon={<Clock className="h-6 w-6" />}
              tone={analytics.statusCounts.Open > 0 ? "warning" : "default"}
            />
            <StatTile
              label="Resolved / closed"
              value={analytics.statusCounts.Resolved + analytics.statusCounts.Closed}
              icon={<CheckCircle2 className="h-6 w-6" />}
              tone="success"
              hint={`${analytics.statusCounts.Resolved} resolved · ${analytics.statusCounts.Closed} closed`}
            />
            <StatTile
              label="Resolved via rapid response"
              value={analytics.rapidResponseCount}
              icon={<Zap className="h-6 w-6" />}
              hint="On receipt, without full investigation"
            />
            <StatTile
              label="Overdue (past target)"
              value={analytics.overdue}
              icon={<AlertTriangle className="h-6 w-6" />}
              tone={analytics.overdue > 0 ? "destructive" : "default"}
            />
            <StatTile
              label="Open high-severity cases"
              value={analytics.openHighSeverity}
              icon={<Siren className="h-6 w-6" />}
              tone={analytics.openHighSeverity > 0 ? "destructive" : "default"}
              hint="Includes human-rights related grievances"
            />
            <StatTile
              label="In litigation"
              value={analytics.litigationCount}
              icon={<Gavel className="h-6 w-6" />}
            />
            <StatTile
              label="Avg. days to resolution"
              value={analytics.avgDaysToResolution ?? "—"}
              icon={<Timer className="h-6 w-6" />}
              hint="Receipt → resolution"
            />
          </div>

          {/* Trend analysis (§6.8): is there movement month over month? */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Trend — received vs resolved</CardTitle>
              <CardDescription>
                Last 12 months, by month of receipt / resolution.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MonthlyTrendChart data={analytics.monthly} />
              {/* Table view — the accessible fallback for the chart. */}
              <div className="mt-4 overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Resolved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.monthly.map((m) => (
                      <TableRow key={m.month}>
                        <TableCell className="text-sm">{m.month}</TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {m.received}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {m.resolved}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Classification by severity — review verification (§6.8) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By severity level</CardTitle>
                <CardDescription>
                  Verification that grievances are correctly classified (§6.3).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SeverityChart data={analytics.severityCounts} />
              </CardContent>
            </Card>

            {/* Recurring / systemic themes (§6.8 KPI e) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By nature of complaint</CardTitle>
                <CardDescription>
                  Recurring or systemic grievances — repeated natures point to
                  preventive measures.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nature</TableHead>
                        <TableHead className="text-right">Cases</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.byNature.map((n) => (
                        <TableRow key={n.nature}>
                          <TableCell className="text-sm">{n.nature}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {n.total}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">By category — open vs resolved</CardTitle>
                <CardDescription>
                  Total received per area of concern (§3 scope).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryChart data={analytics.byCategory} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">By operational area</CardTitle>
                <CardDescription>
                  Where grievances are concentrated (Land Area, Swamp Area, PH Office).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Area</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Open</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analytics.byArea.map((a) => (
                        <TableRow key={a.area}>
                          <TableCell className="text-sm">{a.area}</TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {a.total}
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums">
                            {a.open}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
