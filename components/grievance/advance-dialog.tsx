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
import {
  GRIEVANCE_STEPS,
  type GrievanceClosureType,
  type GrievanceResolutionType,
  type GrievanceWithMeta,
} from "@/types";

export type AdvanceIntent =
  | "advance" // move to the next process step
  | "assign" // set the Grievance Owner / Action Department
  | "resolve" // record the resolution
  | "close"; // close out the case

const RESOLUTION_TYPES: GrievanceResolutionType[] = [
  "Rapid Response",
  "First-Level Resolution",
  "GRC Resolution",
  "External Redress",
];

const CLOSURE_TYPES: GrievanceClosureType[] = [
  "Complainant Sign-Off",
  "External Redress",
  "Abandoned",
];

/**
 * Case-workflow dialog: advances the case through the grievance process
 * (Figure 1), records assignment, resolution and close-out — every submit
 * writes an audit-trail event via POST /api/grievances/:id/advance.
 */
export function AdvanceDialog({
  open,
  onOpenChange,
  grievance,
  intent,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  grievance: GrievanceWithMeta;
  intent: AdvanceIntent;
  onSaved: () => void;
}) {
  const [responsibleDepartment, setResponsibleDepartment] = React.useState(
    grievance.responsibleDepartment ?? ""
  );
  const [responsiblePerson, setResponsiblePerson] = React.useState(
    grievance.responsiblePerson ?? ""
  );
  const [actionRequired, setActionRequired] = React.useState(
    grievance.actionRequired ?? ""
  );
  const [targetResolutionDate, setTargetResolutionDate] = React.useState(
    grievance.targetResolutionDate ?? ""
  );
  const [resolutionType, setResolutionType] = React.useState<
    GrievanceResolutionType | ""
  >("");
  const [resolutionNotes, setResolutionNotes] = React.useState("");
  const [resolvedDate, setResolvedDate] = React.useState("");
  const [rapidResponse, setRapidResponse] = React.useState(grievance.rapidResponse);
  const [closureType, setClosureType] = React.useState<GrievanceClosureType | "">(
    ""
  );
  const [closureNotes, setClosureNotes] = React.useState("");
  const [closedDate, setClosedDate] = React.useState("");
  const [note, setNote] = React.useState("");
  const [actor, setActor] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setResponsibleDepartment(grievance.responsibleDepartment ?? "");
    setResponsiblePerson(grievance.responsiblePerson ?? "");
    setActionRequired(grievance.actionRequired ?? "");
    setTargetResolutionDate(grievance.targetResolutionDate ?? "");
    setResolutionType(grievance.resolutionType ?? "");
    setResolutionNotes(grievance.resolutionNotes ?? "");
    setResolvedDate(grievance.resolvedDate ?? "");
    setRapidResponse(grievance.rapidResponse);
    setClosureType(grievance.closureType ?? "");
    setClosureNotes(grievance.closureNotes ?? "");
    setClosedDate(grievance.closedDate ?? "");
    setNote("");
    setActor("");
  }, [open, grievance]);

  // The next step on the process ladder (Figure 1), for one-click advancing.
  const stepIndex = GRIEVANCE_STEPS.indexOf(grievance.step);
  const nextStep =
    stepIndex >= 0 && stepIndex < GRIEVANCE_STEPS.length - 1
      ? GRIEVANCE_STEPS[stepIndex + 1]
      : undefined;

  const today = new Date().toISOString().slice(0, 10);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body: Record<string, unknown> = {
      note: note.trim() || undefined,
      actor: actor.trim() || undefined,
    };

    if (intent === "advance") {
      if (!nextStep) return setError("This case is already at the final step.");
      body.step = nextStep;
    } else if (intent === "assign") {
      body.responsibleDepartment = responsibleDepartment.trim() || undefined;
      body.responsiblePerson = responsiblePerson.trim() || undefined;
      body.actionRequired = actionRequired.trim() || undefined;
      body.targetResolutionDate = targetResolutionDate || undefined;
      if (grievance.step === "Receive & Register" || grievance.step === "Acknowledge") {
        body.step = "Assess & Assign";
      }
    } else if (intent === "resolve") {
      if (!resolutionType) {
        return setError(
          "Record how the grievance was resolved (resolution level)."
        );
      }
      body.resolutionType = resolutionType;
      body.resolutionNotes = resolutionNotes.trim() || undefined;
      body.resolvedDate = resolvedDate || today;
      body.rapidResponse = rapidResponse;
      body.status = "Resolved";
      if (grievance.step !== "Follow-Up & Close") {
        body.step = "Follow-Up & Close";
      }
    } else if (intent === "close") {
      if (!closureType) {
        return setError(
          "A grievance is closed when the complainant signs off, opts for external redress, or the case is abandoned — pick the closure grounds."
        );
      }
      body.closureType = closureType;
      body.closureNotes = closureNotes.trim() || undefined;
      body.closedDate = closedDate || today;
      body.status = closureType === "Abandoned" ? "Abandoned" : "Closed";
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/grievances/${grievance.id}/advance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Update failed.");
      toast.success(
        intent === "advance"
          ? `Moved to ${nextStep}.`
          : intent === "assign"
            ? "Assignment saved."
            : intent === "resolve"
              ? "Grievance marked as resolved."
              : "Case closed out."
      );
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setSaving(false);
    }
  }

  const titles: Record<AdvanceIntent, string> = {
    advance: `Advance to ${nextStep ?? "…"}`,
    assign: "Assess & assign",
    resolve: "Record resolution",
    close: "Close out case",
  };
  const descriptions: Record<AdvanceIntent, string> = {
    advance: `Move the case to the next stage of the grievance process (Figure 1). The change is recorded in the case history.`,
    assign: "Assign the Grievance Owner and Action Department responsible for investigating and resolving this grievance.",
    resolve: "Record the resolution level agreed with the complainant (§6.6: First-Level, GRC, Rapid Response or External Redress).",
    close: "Close-out (§6.6): a grievance is closed when the complainant signs off after agreed actions, opts for external redress, or the case is abandoned.",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{titles[intent]}</DialogTitle>
          <DialogDescription>{descriptions[intent]}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {intent === "advance" && (
            <div className="rounded-md border bg-secondary/40 p-3 text-sm">
              <p className="text-muted-foreground">Current step</p>
              <p className="font-medium">{grievance.step}</p>
            </div>
          )}

          {intent === "assign" && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="a-dept">Responsible department</Label>
                  <Input
                    id="a-dept"
                    value={responsibleDepartment}
                    onChange={(e) => setResponsibleDepartment(e.target.value)}
                    placeholder="Action Department"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="a-person">Responsible person</Label>
                  <Input
                    id="a-person"
                    value={responsiblePerson}
                    onChange={(e) => setResponsiblePerson(e.target.value)}
                    placeholder="Grievance Owner"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="a-action">Action to be done</Label>
                <Input
                  id="a-action"
                  value={actionRequired}
                  onChange={(e) => setActionRequired(e.target.value)}
                  placeholder="What must happen to resolve this grievance"
                />
              </div>
              <DateField
                label="Target resolution date"
                value={targetResolutionDate}
                onChange={setTargetResolutionDate}
                optional
              />
            </div>
          )}

          {intent === "resolve" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Resolution level</Label>
                <Select
                  value={resolutionType}
                  onValueChange={(v) => setResolutionType(v as GrievanceResolutionType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="How was it resolved?" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-notes">Resolution summary</Label>
                <Textarea
                  id="r-notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Agreed outcome, corrective actions, remedies…"
                />
              </div>
              <DateField
                label="Date resolved"
                value={resolvedDate}
                onChange={setResolvedDate}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rapidResponse}
                  onChange={(e) => setRapidResponse(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                Resolved through rapid response (on receipt)
              </label>
            </div>
          )}

          {intent === "close" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Closure grounds</Label>
                <Select
                  value={closureType}
                  onValueChange={(v) => setClosureType(v as GrievanceClosureType)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Why is the case closing?" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLOSURE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="c-notes">Close-out notes</Label>
                <Textarea
                  id="c-notes"
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  placeholder="Sign-off details, post-resolution evaluation…"
                />
              </div>
              <DateField
                label="Date closed"
                value={closedDate}
                onChange={setClosedDate}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="a-note">Note {intent === "advance" ? "(optional)" : ""}</Label>
            <Textarea
              id="a-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Context for the case history…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-actor">Recorded by</Label>
            <Input
              id="a-actor"
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="Officer handling this action"
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
              {saving ? "Saving…" : titles[intent]}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
