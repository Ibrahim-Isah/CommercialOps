"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import { Plus, Pencil, Trash2, FileCheck2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, ErrorState, EmptyState } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CertDialog } from "@/components/certificates/cert-dialog";
import { StatusBadge } from "@/components/certificates/status-badge";
import { useCertStore } from "@/lib/stores";
import type { CertificateWithStatus } from "@/types";

type SortKey = "name" | "expirationDate" | "status";

export default function CertificatesPage() {
  const { certificates, loading, loaded, error, refresh } = useCertStore();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<CertificateWithStatus | null>(
    null
  );
  const [toDelete, setToDelete] =
    React.useState<CertificateWithStatus | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>("expirationDate");

  React.useEffect(() => {
    if (!loaded) void refresh();
  }, [loaded, refresh]);

  const expiring = certificates
    .filter((c) => c.status === "Expiring Soon")
    .sort((a, b) => a.daysRemaining - b.daysRemaining);

  const sorted = [...certificates].sort((a, b) => {
    if (sortKey === "name") return a.name.localeCompare(b.name);
    if (sortKey === "status") return a.daysRemaining - b.daysRemaining;
    return (
      new Date(a.expirationDate).getTime() -
      new Date(b.expirationDate).getTime()
    );
  });

  function openAdd() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(cert: CertificateWithStatus) {
    setEditing(cert);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/certificates/${toDelete.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("Certificate deleted.");
      setToDelete(null);
      await refresh();
    } catch {
      toast.error("Could not delete the certificate.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Certificates & Clearances"
        description="Track regulatory and operational documents and their expiry."
      >
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add Certificate
        </Button>
      </PageHeader>

      {expiring.length > 0 && (
        <Alert variant="warning" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {expiring.length} certificate{expiring.length > 1 ? "s" : ""}{" "}
            expiring within 30 days
          </AlertTitle>
          <AlertDescription>
            {expiring
              .slice(0, 5)
              .map((c) => `${c.name} (${c.daysRemaining}d)`)
              .join(" · ")}
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-0">
          {loading && !loaded ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-6">
              <ErrorState message={error} onRetry={() => void refresh()} />
            </div>
          ) : certificates.length === 0 ? (
            <div className="p-6">
              <EmptyState
                message="No certificates yet. Add your first one to start tracking expiries."
                icon={
                  <FileCheck2 className="h-8 w-8 text-muted-foreground" />
                }
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortButton
                      label="Name"
                      active={sortKey === "name"}
                      onClick={() => setSortKey("name")}
                    />
                  </TableHead>
                  <TableHead>Issuing Body</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Issued</TableHead>
                  <TableHead>
                    <SortButton
                      label="Expires"
                      active={sortKey === "expirationDate"}
                      onClick={() => setSortKey("expirationDate")}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      label="Status"
                      active={sortKey === "status"}
                      onClick={() => setSortKey("status")}
                    />
                  </TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((cert) => (
                  <TableRow key={cert.id}>
                    <TableCell className="font-medium">{cert.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {cert.issuingBody}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {cert.category}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {format(parseISO(cert.registrationDate), "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(parseISO(cert.expirationDate), "d MMM yyyy")}
                      <span className="ml-2 text-xs text-muted-foreground">
                        {cert.daysRemaining >= 0
                          ? `${cert.daysRemaining}d left`
                          : `${Math.abs(cert.daysRemaining)}d ago`}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={cert.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${cert.name}`}
                          onClick={() => openEdit(cert)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${cert.name}`}
                          onClick={() => setToDelete(cert)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CertDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        certificate={editing}
        onSaved={() => void refresh()}
      />

      <Dialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Delete certificate?</DialogTitle>
            <DialogDescription>
              This permanently removes{" "}
              <span className="font-medium text-foreground">
                {toDelete?.name}
              </span>
              . This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setToDelete(null)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
