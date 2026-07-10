"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "@/components/supply-chain/date-field";
import { PROJECT_STATUSES } from "@/lib/supply-chain/validation";
import type { SupplyProject, SupplyProjectStatus } from "@/types";

export function StatusDialog({
  open,
  onOpenChange,
  project,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: SupplyProject;
  onSaved: () => void;
}) {
  const [status, setStatus] = React.useState<SupplyProjectStatus>(project.status);
  const [note, setNote] = React.useState("");
  const [actualCompletionDate, setActualCompletionDate] = React.useState("");
  const [finalCost, setFinalCost] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setStatus(project.status);
    setNote("");
    setActualCompletionDate(project.actualCompletionDate ?? "");
    setFinalCost(project.finalCost?.toString() ?? "");
  }, [open, project]);

  const completing = status === "completed";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === project.status) {
      return setError("Pick a different status.");
    }
    if (completing) {
      if (!actualCompletionDate) {
        return setError("The actual completion date is required to complete a project.");
      }
      if (finalCost === "") {
        return setError("The final cost is required so savings can be calculated.");
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/supply-chain/projects/${project.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          note: note.trim() || undefined,
          actualCompletionDate: completing ? actualCompletionDate : undefined,
          finalCost: finalCost === "" ? undefined : Number(finalCost),
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Status change failed.");
      }
      toast.success(`Project marked as ${status}.`);
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Change status</DialogTitle>
          <DialogDescription>
            Every change is recorded in the project&apos;s audit trail.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-status">New status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SupplyProjectStatus)}
            >
              <SelectTrigger id="s-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} disabled={s === project.status}>
                    {s}
                    {s === project.status ? " (current)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {completing && (
            <div className="grid gap-4 sm:grid-cols-2">
              <DateField
                label="Actual completion date"
                value={actualCompletionDate}
                onChange={setActualCompletionDate}
              />
              <div className="space-y-1.5">
                <Label htmlFor="s-final">Final cost (₦)</Label>
                <Input
                  id="s-final"
                  type="number"
                  min={0}
                  value={finalCost}
                  onChange={(e) => setFinalCost(e.target.value)}
                  placeholder="Awarded / negotiated value"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="s-note">Note (optional)</Label>
            <Textarea
              id="s-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why is the status changing?"
            />
          </div>

          {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Change status"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
