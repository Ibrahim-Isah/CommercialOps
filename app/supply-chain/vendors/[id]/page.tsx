"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  DocumentStatusBadge,
  IndigenousBadge,
  ProjectStatusBadge,
  VendorStatusBadge,
} from "@/components/supply-chain/badges";
import { VendorDialog } from "@/components/supply-chain/vendor-dialog";
import { DocumentDialog } from "@/components/supply-chain/document-dialog";
import { ConfirmDialog } from "@/components/supply-chain/confirm-dialog";
import { DualMoney } from "@/components/supply-chain/dual-money";
import { formatPairCompact } from "@/lib/supply-chain/derive";
import type {
  SupplyProjectWithRelations,
  Vendor,
  VendorDocument,
} from "@/types";

interface VendorDetail {
  vendor: Vendor;
  documents: VendorDocument[];
  projects: SupplyProjectWithRelations[];
}

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export default function VendorDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = React.useState<VendorDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [docDialogOpen, setDocDialogOpen] = React.useState(false);
  const [editingDoc, setEditingDoc] = React.useState<VendorDocument | null>(null);
  const [docToDelete, setDocToDelete] = React.useState<VendorDocument | null>(null);
  const [deletingDoc, setDeletingDoc] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/supply-chain/vendors/${params.id}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const body = (await res.json()) as VendorDetail & { error?: string };
      if (!res.ok) throw new Error(body.error);
      setData(body);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Could not load the vendor."
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function confirmDeleteVendor() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/supply-chain/vendors/${params.id}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Delete failed.");
      toast.success("Vendor deleted.");
      router.push("/supply-chain/vendors");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the vendor.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  async function confirmDeleteDoc() {
    if (!docToDelete) return;
    setDeletingDoc(true);
    try {
      const res = await fetch(`/api/supply-chain/documents/${docToDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Document deleted.");
      setDocToDelete(null);
      await load();
    } catch {
      toast.error("Could not delete the document.");
    } finally {
      setDeletingDoc(false);
    }
  }

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
      <Link href="/supply-chain/vendors">
        <ArrowLeft className="mr-2 h-4 w-4" />
        All vendors
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <div>
        {backLink}
        <Skeleton className="mb-6 h-16 w-72" />
        <div className="space-y-6">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        {backLink}
        <EmptyState
          message="This vendor no longer exists."
          icon={<Building2 className="h-8 w-8 text-muted-foreground" />}
        />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div>
        {backLink}
        <ErrorState message={error ?? undefined} onRetry={() => void load()} />
      </div>
    );
  }

  const { vendor, documents, projects } = data;
  const ongoing = projects.filter(
    (p) => p.status === "ongoing" || p.status === "delayed"
  ).length;
  const completed = projects.filter((p) => p.status === "completed").length;
  // Value handled per currency; ₦ and $ are reported side by side (no FX rate).
  const totalValue = projects.reduce(
    (sum, p) => ({
      ngn: sum.ngn + (p.finalCostNgn ?? p.budgetedCostNgn ?? 0),
      usd: sum.usd + (p.finalCostUsd ?? p.budgetedCostUsd ?? 0),
    }),
    { ngn: 0, usd: 0 }
  );

  return (
    <div>
      {backLink}
      <PageHeader
        title={vendor.name}
        description={[vendor.category, vendor.state].filter(Boolean).join(" · ")}
      >
        <VendorStatusBadge status={vendor.status} />
        <IndigenousBadge equity={vendor.nigerianEquityPercentage} />
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </PageHeader>

      <div className="space-y-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
              <Field label="RC number" value={vendor.rcNumber} />
              <Field label="Contact person" value={vendor.contactPerson} />
              <Field label="Email" value={vendor.email} />
              <Field label="Phone" value={vendor.phone} />
              <Field label="Address" value={vendor.address} />
              <Field label="State" value={vendor.state} />
              <Field
                label="Nigerian equity"
                value={
                  vendor.nigerianEquityPercentage !== undefined
                    ? `${vendor.nigerianEquityPercentage}%`
                    : undefined
                }
              />
              <Field
                label="Confidence rating"
                value={
                  vendor.confidenceRating !== undefined ? (
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                      {vendor.confidenceRating.toFixed(1)} / 5
                      {vendor.confidenceOverride !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          (manual)
                        </span>
                      )}
                    </span>
                  ) : (
                    "Not scored yet"
                  )
                }
              />
            </dl>
            {vendor.notes && (
              <p className="rounded-md bg-secondary/50 p-3 text-sm text-muted-foreground">
                {vendor.notes}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total projects" value={projects.length} />
              <Stat label="Ongoing" value={ongoing} />
              <Stat label="Completed" value={completed} />
              <Stat
                label="Total value handled"
                value={formatPairCompact(totalValue)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projects ({projects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects assigned to this vendor yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead className="w-8" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((p) => (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer"
                        onClick={() =>
                          router.push(`/supply-chain/projects/${p.id}`)
                        }
                      >
                        <TableCell>
                          <div className="font-medium">{p.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.referenceNumber}
                          </div>
                        </TableCell>
                        <TableCell>
                          <ProjectStatusBadge status={p.status} className="text-[10px]" />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          <DualMoney
                            ngn={p.finalCostNgn ?? p.budgetedCostNgn}
                            usd={p.finalCostUsd ?? p.budgetedCostUsd}
                            className="items-end"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {format(parseISO(p.startDate), "d MMM yyyy")} →{" "}
                          {format(parseISO(p.endDate), "d MMM yyyy")}
                        </TableCell>
                        <TableCell>
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Permits & clearances ({documents.length})
            </CardTitle>
            <Button
              size="sm"
              onClick={() => {
                setEditingDoc(null);
                setDocDialogOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Document
            </Button>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <EmptyState
                message="No documents recorded. Add the vendor's permits and certificates to track their expiry."
                icon={<FileText className="h-8 w-8 text-muted-foreground" />}
              />
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Document</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Number</TableHead>
                      <TableHead>Issued</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <span className="font-medium">{d.documentName}</span>
                          {d.fileUrl && (
                            <a
                              href={d.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="ml-2 inline-flex items-center text-xs text-accent hover:underline"
                            >
                              file
                              <ExternalLink className="ml-0.5 h-3 w-3" />
                            </a>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {d.documentType}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {d.documentNumber ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {d.issueDate
                            ? format(parseISO(d.issueDate), "d MMM yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {d.expiryDate ? (
                            <>
                              {format(parseISO(d.expiryDate), "d MMM yyyy")}
                              {d.daysToExpiry !== undefined && (
                                <span className="ml-1 text-muted-foreground">
                                  {d.daysToExpiry >= 0
                                    ? `(${d.daysToExpiry}d)`
                                    : `(${Math.abs(d.daysToExpiry)}d ago)`}
                                </span>
                              )}
                            </>
                          ) : (
                            "Does not expire"
                          )}
                        </TableCell>
                        <TableCell>
                          <DocumentStatusBadge status={d.status} className="text-[10px]" />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit ${d.documentName}`}
                              onClick={() => {
                                setEditingDoc(d);
                                setDocDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Delete ${d.documentName}`}
                              onClick={() => setDocToDelete(d)}
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
      </div>

      <VendorDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        vendor={vendor}
        onSaved={() => void load()}
      />

      <DocumentDialog
        open={docDialogOpen}
        onOpenChange={setDocDialogOpen}
        vendorId={vendor.id}
        document={editingDoc}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete vendor?"
        description={
          <>
            This permanently removes{" "}
            <span className="font-medium text-foreground">{vendor.name}</span>{" "}
            and its documents. Vendors with active projects cannot be deleted —
            reassign those projects first.
          </>
        }
        busy={deleting}
        onConfirm={() => void confirmDeleteVendor()}
      />

      <ConfirmDialog
        open={Boolean(docToDelete)}
        onOpenChange={() => setDocToDelete(null)}
        title="Delete document?"
        description={
          <>
            This permanently removes{" "}
            <span className="font-medium text-foreground">
              {docToDelete?.documentName}
            </span>
            .
          </>
        }
        busy={deletingDoc}
        onConfirm={() => void confirmDeleteDoc()}
      />
    </div>
  );
}
