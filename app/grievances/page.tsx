"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { ClipboardList, Plus, Search, Siren } from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FlagBadges,
  GrievanceStatusBadge,
  OverdueBadge,
  SeverityBadge,
} from "@/components/grievance/badges";
import { GrievanceDialog } from "@/components/grievance/grievance-dialog";
import {
  GRIEVANCE_AREAS,
  GRIEVANCE_CATEGORIES,
  GRIEVANCE_SEVERITIES,
} from "@/lib/grievance/validation";
import type {
  GrievanceStatus,
  GrievanceWithMeta,
} from "@/types";

const ALL = "__all__";
const STATUSES: GrievanceStatus[] = ["Open", "Resolved", "Closed", "Abandoned"];

/**
 * The Grievance Register (Annex A.3): every grievance received through the
 * mechanism, with the filters and case flags needed to run the process.
 */
export default function GrievancesPage() {
  const router = useRouter();
  const [grievances, setGrievances] = React.useState<GrievanceWithMeta[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState(ALL);
  const [severityFilter, setSeverityFilter] = React.useState(ALL);
  const [categoryFilter, setCategoryFilter] = React.useState(ALL);
  const [areaFilter, setAreaFilter] = React.useState(ALL);

  const [dialogOpen, setDialogOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/grievances", { cache: "no-store" });
      const data = (await res.json()) as {
        grievances?: GrievanceWithMeta[];
        error?: string;
      };
      if (!res.ok || !data.grievances) throw new Error(data.error);
      setGrievances(data.grievances);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Could not load grievances."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = grievances
    .filter((g) => (statusFilter === ALL ? true : g.status === statusFilter))
    .filter((g) => (severityFilter === ALL ? true : g.severity === severityFilter))
    .filter((g) => (categoryFilter === ALL ? true : g.category === categoryFilter))
    .filter((g) => (areaFilter === ALL ? true : g.area === areaFilter))
    .filter((g) =>
      q
        ? g.title.toLowerCase().includes(q) ||
          g.referenceNumber.toLowerCase().includes(q) ||
          g.complainantName.toLowerCase().includes(q)
        : true
    );

  // Sensitive cases (§6.2) need immediate XMD/GMD attention — surface them.
  const sensitiveCount = grievances.filter(
    (g) => (g.sensitive || g.humanRightsRelated) && g.status === "Open"
  ).length;

  return (
    <div>
      <PageHeader
        title="Grievance Register"
        description="Receive, track and resolve local stakeholder grievances end-to-end (OPI SXD 001/OERNL r01)."
      >
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Register Grievance
        </Button>
      </PageHeader>

      {sensitiveCount > 0 && (
        <Card className="mb-4 border-warning/60 bg-warning/10">
          <CardContent className="flex items-center gap-3 py-4">
            <Siren className="h-5 w-5 shrink-0 text-warning" />
            <p className="text-sm">
              <span className="font-semibold">
                {sensitiveCount} open sensitive / human-rights case
                {sensitiveCount > 1 ? "s" : ""}
              </span>{" "}
              <span className="text-muted-foreground">
                — notify the XMD immediately and escalate reputationally
                significant cases to the GMD (§6.2).
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title, serial number or complainant"
                className="pl-9"
                aria-label="Search grievances"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={setSeverityFilter}>
                <SelectTrigger className="w-[130px]" aria-label="Filter by severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All severities</SelectItem>
                  {GRIEVANCE_SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[190px]" aria-label="Filter by category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  {GRIEVANCE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={areaFilter} onValueChange={setAreaFilter}>
                <SelectTrigger className="w-[160px]" aria-label="Filter by area">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All areas</SelectItem>
                  {GRIEVANCE_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              message={
                grievances.length === 0
                  ? "No grievances registered yet. Log the first complaint to open the register."
                  : "No grievances match the current filters."
              }
              icon={<ClipboardList className="h-8 w-8 text-muted-foreground" />}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serial / Complaint</TableHead>
                    <TableHead>Complainant</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Classification</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Step</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g) => (
                    <TableRow
                      key={g.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/grievances/${g.id}`)}
                    >
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {g.referenceNumber}
                        </div>
                        <div className="font-medium">{g.title}</div>
                        <div className="mt-1">
                          <FlagBadges
                            humanRightsRelated={g.humanRightsRelated}
                            sensitive={g.sensitive}
                            litigation={g.litigation}
                            rapidResponse={g.rapidResponse}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {g.complainantName}
                        <div className="text-xs text-muted-foreground">
                          {g.complainantType}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {[g.community, g.lga, g.state].filter(Boolean).join(", ") ||
                          "—"}
                        <div className="text-xs text-muted-foreground">{g.area}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <SeverityBadge severity={g.severity} className="text-[10px]" />
                          <span className="text-xs text-muted-foreground">
                            {g.category}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <GrievanceStatusBadge status={g.status} className="text-[10px]" />
                          <OverdueBadge overdue={g.overdue} />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {g.step}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {g.responsiblePerson ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(parseISO(g.dateReceived), "d MMM yy")}
                        {g.targetResolutionDate && (
                          <div>
                            target{" "}
                            {format(parseISO(g.targetResolutionDate), "d MMM yy")}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <GrievanceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSaved={() => void load()}
      />
    </div>
  );
}
