"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  FolderKanban,
  History,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NigerianContentBadge,
  ProjectStatusBadge,
} from "@/components/supply-chain/badges";
import { ProjectDialog } from "@/components/supply-chain/project-dialog";
import { StatusDialog } from "@/components/supply-chain/status-dialog";
import { ConfirmDialog } from "@/components/supply-chain/confirm-dialog";
import { formatMoney, formatNaira } from "@/lib/supply-chain/derive";
import type {
  Buyer,
  ProjectStatusChange,
  SupplyProjectWithRelations,
  Vendor,
} from "@/types";

const NO_VENDOR = "__none__";

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] =
    React.useState<SupplyProjectWithRelations | null>(null);
  const [history, setHistory] = React.useState<ProjectStatusChange[]>([]);
  const [buyers, setBuyers] = React.useState<Buyer[]>([]);
  const [vendors, setVendors] = React.useState<Vendor[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [statusOpen, setStatusOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [assigning, setAssigning] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const [pRes, bRes, vRes] = await Promise.all([
        fetch(`/api/supply-chain/projects/${params.id}`, { cache: "no-store" }),
        fetch("/api/supply-chain/buyers", { cache: "no-store" }),
        fetch("/api/supply-chain/vendors", { cache: "no-store" }),
      ]);
      if (pRes.status === 404) {
        setNotFound(true);
        return;
      }
      const pData = (await pRes.json()) as {
        project?: SupplyProjectWithRelations;
        history?: ProjectStatusChange[];
        error?: string;
      };
      if (!pRes.ok || !pData.project) throw new Error(pData.error);
      setProject(pData.project);
      setHistory(pData.history ?? []);
      if (bRes.ok) {
        setBuyers(((await bRes.json()) as { buyers?: Buyer[] }).buyers ?? []);
      }
      if (vRes.ok) {
        setVendors(((await vRes.json()) as { vendors?: Vendor[] }).vendors ?? []);
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Could not load the project."
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function reassignVendor(value: string) {
    setAssigning(true);
    try {
      const res = await fetch(`/api/supply-chain/projects/${params.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId: value === NO_VENDOR ? null : value }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Assignment failed.");
      toast.success(
        value === NO_VENDOR ? "Vendor unassigned." : "Vendor assigned."
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign the vendor.");
    } finally {
      setAssigning(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/supply-chain/projects/${params.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Project deleted.");
      router.push("/supply-chain/projects");
    } catch {
      toast.error("Could not delete the project.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
      <Link href="/supply-chain/projects">
        <ArrowLeft className="mr-2 h-4 w-4" />
        All projects
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <div>
        {backLink}
        <Skeleton className="mb-6 h-16 w-72" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        {backLink}
        <EmptyState
          message="This project no longer exists."
          icon={<FolderKanban className="h-8 w-8 text-muted-foreground" />}
        />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div>
        {backLink}
        <ErrorState message={error ?? undefined} onRetry={() => void load()} />
      </div>
    );
  }

  return (
    <div>
      {backLink}
      <PageHeader title={project.title} description={project.referenceNumber}>
        <ProjectStatusBadge status={project.status} />
        <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Change status
        </Button>
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

      {project.pastDue && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Past its planned end date</AlertTitle>
          <AlertDescription>
            This project was due{" "}
            {format(parseISO(project.endDate), "d MMM yyyy")} and is not
            completed.{" "}
            {project.status !== "delayed" &&
              "Consider marking it as delayed to reflect reality."}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {project.description && (
              <p className="text-sm text-muted-foreground">
                {project.description}
              </p>
            )}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
              <Field
                label="Vendor"
                value={
                  project.vendorId ? (
                    <Link
                      href={`/supply-chain/vendors/${project.vendorId}`}
                      className="inline-flex items-center gap-1 text-accent hover:underline"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {project.vendorName}
                    </Link>
                  ) : (
                    "Unassigned"
                  )
                }
              />
              <Field label="Buyer" value={project.buyerName} />
              <Field label="Procurement method" value={project.procurementMethod} />
              <Field
                label="Nigerian content"
                value={
                  <NigerianContentBadge
                    percentage={project.nigerianContentPercentage}
                  />
                }
              />
              <Field
                label="Start date"
                value={format(parseISO(project.startDate), "d MMM yyyy")}
              />
              <Field
                label="Planned end"
                value={format(parseISO(project.endDate), "d MMM yyyy")}
              />
              <Field
                label="Actual completion"
                value={
                  project.actualCompletionDate
                    ? format(parseISO(project.actualCompletionDate), "d MMM yyyy")
                    : undefined
                }
              />
              <Field label="Currency" value={project.currency} />
            </dl>

            <div className="space-y-1.5 border-t pt-4">
              <p className="text-xs text-muted-foreground">
                Assign / reassign vendor
              </p>
              <Select
                value={project.vendorId ?? NO_VENDOR}
                onValueChange={(v) => void reassignVendor(v)}
                disabled={assigning}
              >
                <SelectTrigger aria-label="Assign vendor">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VENDOR}>Unassigned</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cost breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-3 gap-3">
                <div className="rounded-md border p-3">
                  <dt className="text-xs text-muted-foreground">Budgeted</dt>
                  <dd className="text-lg font-semibold">
                    {formatNaira(project.budgetedCost)}
                  </dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-xs text-muted-foreground">Final</dt>
                  <dd className="text-lg font-semibold">
                    {project.finalCost !== undefined
                      ? formatNaira(project.finalCost)
                      : "—"}
                  </dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-xs text-muted-foreground">Savings</dt>
                  <dd
                    className={
                      "text-lg font-semibold " +
                      (project.costSavings === undefined
                        ? ""
                        : project.costSavings >= 0
                          ? "text-success"
                          : "text-destructive")
                    }
                  >
                    {project.costSavings !== undefined
                      ? formatNaira(project.costSavings)
                      : "—"}
                  </dd>
                </div>
              </dl>
              {project.usdValue !== undefined && (
                <p className="mt-3 text-xs text-muted-foreground">
                  USD value: {formatMoney(project.usdValue, "USD")}
                </p>
              )}
              {project.costSavings === undefined && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Savings are calculated once a final cost is recorded
                  (usually when the project completes).
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <History className="h-4 w-4" />
                Status history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No status changes recorded yet.
                </p>
              ) : (
                <ol className="space-y-3">
                  {history.map((h) => (
                    <li key={h.id} className="flex gap-3 text-sm">
                      <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                      <div className="min-w-0">
                        <p>
                          {h.oldStatus ? (
                            <>
                              <span className="text-muted-foreground">
                                {h.oldStatus}
                              </span>{" "}
                              →{" "}
                            </>
                          ) : null}
                          <span className="font-medium">{h.newStatus}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(h.changedAt), "d MMM yyyy, HH:mm")}
                          {h.changedByName ? ` · ${h.changedByName}` : ""}
                        </p>
                        {h.note && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            “{h.note}”
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ProjectDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        buyers={buyers}
        vendors={vendors}
        onSaved={() => void load()}
        onBuyersChanged={() => void load()}
      />

      <StatusDialog
        open={statusOpen}
        onOpenChange={setStatusOpen}
        project={project}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete project?"
        description={
          <>
            This permanently removes{" "}
            <span className="font-medium text-foreground">{project.title}</span>{" "}
            and its status history. This cannot be undone.
          </>
        }
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
