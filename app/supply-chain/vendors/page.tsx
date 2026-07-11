"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Eye, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
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
import {
  IndigenousBadge,
  VendorStatusBadge,
} from "@/components/supply-chain/badges";
import { VendorDialog } from "@/components/supply-chain/vendor-dialog";
import { ConfirmDialog } from "@/components/supply-chain/confirm-dialog";
import {
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
} from "@/lib/supply-chain/validation";
import type { VendorWithStats } from "@/types";

const ALL = "__all__";
type SortKey = "name" | "projects" | "confidence";

function DocumentHealth({ vendor }: { vendor: VendorWithStats }) {
  const { total, expired, expiringSoon } = vendor.documentCounts;
  if (total === 0) {
    return (
      <Badge variant="outline" className="text-[10px]">
        No documents
      </Badge>
    );
  }
  if (expired > 0) {
    return <Badge variant="destructive">{expired} expired</Badge>;
  }
  if (expiringSoon > 0) {
    return <Badge variant="warning">{expiringSoon} expiring</Badge>;
  }
  return <Badge variant="success">All valid</Badge>;
}

export default function VendorsPage() {
  const router = useRouter();
  const [vendors, setVendors] = React.useState<VendorWithStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState(ALL);
  const [status, setStatus] = React.useState(ALL);
  const [sortKey, setSortKey] = React.useState<SortKey>("name");

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<VendorWithStats | null>(null);
  const [toDelete, setToDelete] = React.useState<VendorWithStats | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/supply-chain/vendors", { cache: "no-store" });
      const data = (await res.json()) as {
        vendors?: VendorWithStats[];
        error?: string;
      };
      if (!res.ok || !data.vendors) throw new Error(data.error);
      setVendors(data.vendors);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Could not load vendors.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = vendors
    .filter((v) => (q ? v.name.toLowerCase().includes(q) : true))
    .filter((v) => (category === ALL ? true : v.category === category))
    .filter((v) => (status === ALL ? true : v.status === status))
    .sort((a, b) => {
      if (sortKey === "projects") return b.projectCount - a.projectCount;
      if (sortKey === "confidence") {
        return (b.confidenceRating ?? -1) - (a.confidenceRating ?? -1);
      }
      return a.name.localeCompare(b.name);
    });

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/supply-chain/vendors/${toDelete.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      toast.success(`${toDelete.name} deleted.`);
      setToDelete(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the vendor.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Contractors and suppliers, their documents and performance."
      >
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Vendor
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search vendors by name"
                className="pl-9"
                aria-label="Search vendors"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-[210px]" aria-label="Filter by category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  {VENDOR_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-[150px]" aria-label="Filter by status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All statuses</SelectItem>
                  {VENDOR_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
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
                vendors.length === 0
                  ? "No vendors yet. Create your first vendor to start tracking documents and projects."
                  : "No vendors match the current search or filters."
              }
              icon={<Building2 className="h-8 w-8 text-muted-foreground" />}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton label="Vendor" active={sortKey === "name"} onClick={() => setSortKey("name")} />
                    </TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">
                      <SortButton label="Projects" active={sortKey === "projects"} onClick={() => setSortKey("projects")} />
                    </TableHead>
                    <TableHead className="text-right">
                      <SortButton label="Confidence" active={sortKey === "confidence"} onClick={() => setSortKey("confidence")} />
                    </TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead className="text-right">NG equity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((v) => (
                    <TableRow
                      key={v.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/supply-chain/vendors/${v.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{v.name}</span>
                          <IndigenousBadge equity={v.nigerianEquityPercentage} />
                        </div>
                        {v.rcNumber && (
                          <div className="text-xs text-muted-foreground">
                            {v.rcNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {v.category}
                      </TableCell>
                      <TableCell className="text-right">{v.projectCount}</TableCell>
                      <TableCell className="text-right">
                        {v.confidenceRating !== undefined ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                            {v.confidenceRating.toFixed(1)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DocumentHealth vendor={v} />
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {v.nigerianEquityPercentage !== undefined
                          ? `${v.nigerianEquityPercentage}%`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <VendorStatusBadge status={v.status} className="text-[10px]" />
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild aria-label={`View ${v.name}`}>
                            <Link href={`/supply-chain/vendors/${v.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${v.name}`}
                            onClick={() => {
                              setEditing(v);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${v.name}`}
                            onClick={() => setToDelete(v)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <VendorDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vendor={editing}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={() => setToDelete(null)}
        title="Delete vendor?"
        description={
          <>
            This permanently removes{" "}
            <span className="font-medium text-foreground">{toDelete?.name}</span>{" "}
            and its documents. Vendors with active projects cannot be deleted.
          </>
        }
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1 font-medium hover:text-foreground " +
        (active ? "text-foreground underline underline-offset-4" : "")
      }
    >
      {label}
    </button>
  );
}
