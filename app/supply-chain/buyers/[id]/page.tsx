"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  ExternalLink,
  History,
  Mail,
  Pencil,
  Trash2,
  Users,
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
import { ProjectStatusBadge } from "@/components/supply-chain/badges";
import { BuyerDialog } from "@/components/supply-chain/buyer-dialog";
import { ConfirmDialog } from "@/components/supply-chain/confirm-dialog";
import { DualMoney } from "@/components/supply-chain/dual-money";
import { formatPairCompact } from "@/lib/supply-chain/derive";
import type {
  Buyer,
  BuyerActivity,
  SupplyProjectWithRelations,
} from "@/types";

interface BuyerDetail {
  buyer: Buyer;
  projects: SupplyProjectWithRelations[];
  activity: BuyerActivity[];
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

export default function BuyerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [data, setData] = React.useState<BuyerDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/supply-chain/buyers/${params.id}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const body = (await res.json()) as BuyerDetail & { error?: string };
      if (!res.ok) throw new Error(body.error);
      setData(body);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Could not load the buyer."
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/supply-chain/buyers/${params.id}`, {
        method: "DELETE",
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Delete failed.");
      toast.success("Buyer deleted.");
      router.push("/supply-chain/buyers");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the buyer.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  const backLink = (
    <Button variant="ghost" size="sm" asChild className="mb-4 -ml-2">
      <Link href="/supply-chain/buyers">
        <ArrowLeft className="mr-2 h-4 w-4" />
        All buyers
      </Link>
    </Button>
  );

  if (loading) {
    return (
      <div>
        {backLink}
        <Skeleton className="mb-6 h-16 w-72" />
        <div className="space-y-6">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        {backLink}
        <EmptyState
          message="This buyer no longer exists."
          icon={<Users className="h-8 w-8 text-muted-foreground" />}
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

  const { buyer, projects, activity } = data;
  const ongoing = projects.filter(
    (p) => p.status === "ongoing" || p.status === "delayed"
  ).length;
  const completed = projects.filter((p) => p.status === "completed").length;
  const savings = projects.reduce(
    (sum, p) => ({
      ngn: sum.ngn + (p.costSavingsNgn ?? 0),
      usd: sum.usd + (p.costSavingsUsd ?? 0),
    }),
    { ngn: 0, usd: 0 }
  );

  return (
    <div>
      {backLink}
      <PageHeader
        title={buyer.fullName}
        description={`Buyer since ${format(parseISO(buyer.createdAt), "d MMM yyyy")}`}
      >
        <a
          href={`mailto:${buyer.email}`}
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          <Mail className="h-3.5 w-3.5" />
          {buyer.email}
        </a>
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total projects" value={projects.length} />
          <Stat label="Ongoing" value={ongoing} />
          <Stat label="Completed" value={completed} />
          <Stat
            label="Total cost savings"
            value={
              projects.length === 0 ? "—" : formatPairCompact(savings)
            }
          />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Projects handled ({projects.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No projects assigned to this buyer yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead>Vendor</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Budgeted</TableHead>
                      <TableHead className="text-right">Savings</TableHead>
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
                        <TableCell className="text-sm">
                          {p.vendorName ?? (
                            <span className="text-muted-foreground">
                              Unassigned
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ProjectStatusBadge
                            status={p.status}
                            className="text-[10px]"
                          />
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
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <History className="h-4 w-4" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No status changes recorded by this buyer yet.
              </p>
            ) : (
              <ol className="space-y-3">
                {activity.map((a) => (
                  <li key={a.id} className="flex gap-3 text-sm">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent" />
                    <div className="min-w-0">
                      <p>
                        <Link
                          href={`/supply-chain/projects/${a.projectId}`}
                          className="font-medium hover:text-accent hover:underline"
                        >
                          {a.projectTitle}
                        </Link>
                        {" — "}
                        {a.oldStatus ? (
                          <>
                            <span className="text-muted-foreground">
                              {a.oldStatus}
                            </span>{" "}
                            →{" "}
                          </>
                        ) : null}
                        <span className="font-medium">{a.newStatus}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(a.changedAt), "d MMM yyyy, HH:mm")}
                      </p>
                      {a.note && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          “{a.note}”
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

      <BuyerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        buyer={buyer}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete buyer?"
        description={
          <>
            This permanently removes{" "}
            <span className="font-medium text-foreground">
              {buyer.fullName}
            </span>
            . Buyers who still handle projects cannot be deleted — reassign
            their projects first.
          </>
        }
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
