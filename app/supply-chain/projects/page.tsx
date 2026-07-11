"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { format, parseISO } from "date-fns";
import {
  FolderKanban,
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { ProjectStatusBadge } from "@/components/supply-chain/badges";
import { ProjectDialog } from "@/components/supply-chain/project-dialog";
import { DualMoney } from "@/components/supply-chain/dual-money";
import { PROJECT_STATUSES } from "@/lib/supply-chain/validation";
import type {
  Buyer,
  SupplyProjectStatus,
  SupplyProjectWithRelations,
  Vendor,
} from "@/types";

const ALL = "__all__";

function isStatus(v: string | null): v is SupplyProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(v ?? "");
}

function ProjectsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [projects, setProjects] = React.useState<SupplyProjectWithRelations[]>([]);
  const [buyers, setBuyers] = React.useState<Buyer[]>([]);
  const [vendors, setVendors] = React.useState<Vendor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Status filter is URL-driven so the Analytics cards can deep link here.
  const urlStatus = searchParams.get("status");
  const status = isStatus(urlStatus) ? urlStatus : ALL;
  const [vendorFilter, setVendorFilter] = React.useState(ALL);
  const [buyerFilter, setBuyerFilter] = React.useState(ALL);
  const [query, setQuery] = React.useState("");
  const [view, setView] = React.useState<"table" | "cards">("table");

  const [dialogOpen, setDialogOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pRes, bRes, vRes] = await Promise.all([
        fetch("/api/supply-chain/projects", { cache: "no-store" }),
        fetch("/api/supply-chain/buyers", { cache: "no-store" }),
        fetch("/api/supply-chain/vendors", { cache: "no-store" }),
      ]);
      const pData = (await pRes.json()) as {
        projects?: SupplyProjectWithRelations[];
        error?: string;
      };
      if (!pRes.ok || !pData.projects) throw new Error(pData.error);
      setProjects(pData.projects);
      if (bRes.ok) {
        setBuyers(((await bRes.json()) as { buyers?: Buyer[] }).buyers ?? []);
      }
      if (vRes.ok) {
        setVendors(((await vRes.json()) as { vendors?: Vendor[] }).vendors ?? []);
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Could not load projects."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  function setStatusFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL) params.delete("status");
    else params.set("status", value);
    router.replace(
      `/supply-chain/projects${params.size ? `?${params}` : ""}`,
      { scroll: false }
    );
  }

  const q = query.trim().toLowerCase();
  const filtered = projects
    .filter((p) => (status === ALL ? true : p.status === status))
    .filter((p) => (vendorFilter === ALL ? true : p.vendorId === vendorFilter))
    .filter((p) => (buyerFilter === ALL ? true : p.buyerId === buyerFilter))
    .filter((p) =>
      q
        ? p.title.toLowerCase().includes(q) ||
          p.referenceNumber.toLowerCase().includes(q)
        : true
    );

  const openProject = (id: string) => router.push(`/supply-chain/projects/${id}`);

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Procurement projects, their vendors, buyers and cost performance."
      >
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by title or reference number"
                className="pl-9"
                aria-label="Search projects"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={status} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={vendorFilter} onValueChange={setVendorFilter}>
                <SelectTrigger className="w-[170px]" aria-label="Filter by vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All vendors</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={buyerFilter} onValueChange={setBuyerFilter}>
                <SelectTrigger className="w-[160px]" aria-label="Filter by buyer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All buyers</SelectItem>
                  {buyers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex rounded-md border">
                <Button
                  variant={view === "table" ? "secondary" : "ghost"}
                  size="icon"
                  aria-label="Table view"
                  onClick={() => setView("table")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === "cards" ? "secondary" : "ghost"}
                  size="icon"
                  aria-label="Card view"
                  onClick={() => setView("cards")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
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
                projects.length === 0
                  ? "No projects yet. Create your first procurement project."
                  : "No projects match the current filters."
              }
              icon={<FolderKanban className="h-8 w-8 text-muted-foreground" />}
            />
          ) : view === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => openProject(p.id)}
                  className="rounded-lg border p-4 text-left transition-colors hover:bg-secondary/40"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="font-medium leading-tight">{p.title}</span>
                    <ProjectStatusBadge status={p.status} className="shrink-0 text-[10px]" />
                  </div>
                  <p className="text-xs text-muted-foreground">{p.referenceNumber}</p>
                  <p className="mt-2 text-sm">
                    {p.vendorName ?? "Unassigned"} ·{" "}
                    <span className="text-muted-foreground">{p.buyerName}</span>
                  </p>
                  <p className="mt-2 text-sm font-semibold">
                    <DualMoney
                      ngn={p.finalCostNgn ?? p.budgetedCostNgn}
                      usd={p.finalCostUsd ?? p.budgetedCostUsd}
                    />
                  </p>
                  {(p.costSavingsNgn !== undefined ||
                    p.costSavingsUsd !== undefined) && (
                    <p className="mt-1 text-xs">
                      <span className="text-muted-foreground">Savings: </span>
                      <DualMoney
                        ngn={p.costSavingsNgn}
                        usd={p.costSavingsUsd}
                        signed
                      />
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format(parseISO(p.startDate), "d MMM yyyy")} →{" "}
                    {format(parseISO(p.endDate), "d MMM yyyy")}
                    {p.pastDue && (
                      <Badge variant="warning" className="ml-2 text-[10px]">
                        past due
                      </Badge>
                    )}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Budgeted</TableHead>
                    <TableHead className="text-right">Final</TableHead>
                    <TableHead className="text-right">Savings</TableHead>
                    <TableHead>Dates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => (
                    <TableRow
                      key={p.id}
                      className="cursor-pointer"
                      onClick={() => openProject(p.id)}
                    >
                      <TableCell>
                        <div className="font-medium">{p.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.referenceNumber}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.vendorName ?? (
                          <span className="text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.buyerName}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ProjectStatusBadge status={p.status} className="text-[10px]" />
                          {p.pastDue && (
                            <Badge variant="warning" className="text-[10px]">
                              past due
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <DualMoney
                          ngn={p.budgetedCostNgn}
                          usd={p.budgetedCostUsd}
                          className="items-end"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <DualMoney
                          ngn={p.finalCostNgn}
                          usd={p.finalCostUsd}
                          className="items-end"
                        />
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <DualMoney
                          ngn={p.costSavingsNgn}
                          usd={p.costSavingsUsd}
                          signed
                          className="items-end"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(parseISO(p.startDate), "d MMM yy")} →{" "}
                        {format(parseISO(p.endDate), "d MMM yy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        buyers={buyers}
        vendors={vendors}
        onSaved={() => void load()}
        onBuyersChanged={() => void load()}
      />
    </div>
  );
}

export default function ProjectsPage() {
  // useSearchParams requires a Suspense boundary in the app router.
  return (
    <React.Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <ProjectsPageInner />
    </React.Suspense>
  );
}
