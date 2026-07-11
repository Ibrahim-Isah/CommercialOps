"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BuyerDialog } from "@/components/supply-chain/buyer-dialog";
import { ConfirmDialog } from "@/components/supply-chain/confirm-dialog";
import { DualMoney } from "@/components/supply-chain/dual-money";
import type { BuyerWithStats } from "@/types";

type SortKey = "name" | "projects" | "savings";

export default function BuyersPage() {
  const router = useRouter();
  const [buyers, setBuyers] = React.useState<BuyerWithStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BuyerWithStats | null>(null);
  const [toDelete, setToDelete] = React.useState<BuyerWithStats | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/supply-chain/buyers", { cache: "no-store" });
      const data = (await res.json()) as {
        buyers?: BuyerWithStats[];
        error?: string;
      };
      if (!res.ok || !data.buyers) throw new Error(data.error);
      setBuyers(data.buyers);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Could not load buyers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = buyers
    .filter((b) =>
      q
        ? b.fullName.toLowerCase().includes(q) || b.email.toLowerCase().includes(q)
        : true
    )
    .sort((a, b) => {
      if (sortKey === "projects") return b.projectCount - a.projectCount;
      if (sortKey === "savings") {
        return b.savingsNgn - a.savingsNgn || b.savingsUsd - a.savingsUsd;
      }
      return a.fullName.localeCompare(b.fullName);
    });

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/supply-chain/buyers/${toDelete.id}`, {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Delete failed.");
      toast.success(`${toDelete.fullName} deleted.`);
      setToDelete(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the buyer.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Buyers"
        description="Procurement staff, the projects they handle and the savings they deliver."
      >
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          New Buyer
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search buyers by name or email"
              className="pl-9"
              aria-label="Search buyers"
            />
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={() => void load()} />
          ) : filtered.length === 0 ? (
            <EmptyState
              message={
                buyers.length === 0
                  ? "No buyers yet. Add your procurement staff to start assigning projects."
                  : "No buyers match your search."
              }
              icon={<Users className="h-8 w-8 text-muted-foreground" />}
            />
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <SortButton label="Buyer" active={sortKey === "name"} onClick={() => setSortKey("name")} />
                    </TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">
                      <SortButton label="Projects" active={sortKey === "projects"} onClick={() => setSortKey("projects")} />
                    </TableHead>
                    <TableHead className="text-right">Ongoing</TableHead>
                    <TableHead className="text-right">
                      <SortButton label="Cost savings" active={sortKey === "savings"} onClick={() => setSortKey("savings")} />
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow
                      key={b.id}
                      className="cursor-pointer"
                      onClick={() => router.push(`/supply-chain/buyers/${b.id}`)}
                    >
                      <TableCell className="font-medium">{b.fullName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {b.email}
                      </TableCell>
                      <TableCell className="text-right">{b.projectCount}</TableCell>
                      <TableCell className="text-right">{b.ongoingCount}</TableCell>
                      <TableCell className="text-right text-sm">
                        {b.projectCount === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <DualMoney
                            ngn={b.savingsNgn}
                            usd={b.savingsUsd !== 0 ? b.savingsUsd : undefined}
                            signed
                            className="items-end"
                          />
                        )}
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" asChild aria-label={`View ${b.fullName}`}>
                            <Link href={`/supply-chain/buyers/${b.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit ${b.fullName}`}
                            onClick={() => {
                              setEditing(b);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Delete ${b.fullName}`}
                            onClick={() => setToDelete(b)}
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

      <BuyerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        buyer={editing}
        onSaved={() => void load()}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={() => setToDelete(null)}
        title="Delete buyer?"
        description={
          <>
            This permanently removes{" "}
            <span className="font-medium text-foreground">
              {toDelete?.fullName}
            </span>
            . Buyers who still handle projects cannot be deleted.
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
