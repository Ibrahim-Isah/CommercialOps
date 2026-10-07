"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  Handshake,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { PageHeader, ErrorState } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FlagBadges,
  GrievanceStatusBadge,
  OverdueBadge,
  SeverityBadge,
} from "@/components/grievance/badges";
import { ProcessStepper } from "@/components/grievance/process-stepper";
import { EventLog } from "@/components/grievance/event-log";
import { GrievanceDialog } from "@/components/grievance/grievance-dialog";
import {
  AdvanceDialog,
  type AdvanceIntent,
} from "@/components/grievance/advance-dialog";
import { ConfirmDialog } from "@/components/supply-chain/confirm-dialog";
import type { GrievanceEvent, GrievanceEventType, GrievanceWithMeta } from "@/types";

function Field({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function dateStr(iso?: string): string | undefined {
  return iso ? format(parseISO(iso), "d MMM yyyy") : undefined;
}

/** Case file for one grievance: registration record, process stepper,
 *  workflow actions (assign / resolve / close-out) and the audit trail. */
export default function GrievanceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [grievance, setGrievance] = React.useState<GrievanceWithMeta | null>(null);
  const [events, setEvents] = React.useState<GrievanceEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [advanceIntent, setAdvanceIntent] = React.useState<AdvanceIntent | null>(null);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    try {
      const res = await fetch(`/api/grievances/${params.id}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = (await res.json()) as {
        grievance?: GrievanceWithMeta;
        events?: GrievanceEvent[];
        error?: string;
      };
      if (!res.ok || !data.grievance) throw new Error(data.error);
      setGrievance(data.grievance);
      setEvents(data.events ?? []);
    } catch (e) {
      setError(
        e instanceof Error && e.message ? e.message : "Could not load the grievance."
      );
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function logEvent(type: GrievanceEventType, note: string, actor: string) {
    try {
      const res = await fetch(`/api/grievances/${params.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, note, actor: actor || undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Logging failed.");
      toast.success("Entry added to the case history.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not log the entry.");
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/grievances/${params.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Grievance deleted.");
      router.push("/grievances");
    } catch {
      toast.error("Could not delete the grievance.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (notFound) {
    return (
      <ErrorState
        message="That grievance does not exist."
        onRetry={() => router.push("/grievances")}
      />
    );
  }

  if (error || !grievance) {
    return <ErrorState message={error ?? "Could not load the grievance."} onRetry={() => void load()} />;
  }

  const g = grievance;
  const settled = g.status !== "Open";

  return (
    <div>
      <PageHeader title={g.title} description={`${g.referenceNumber} · received ${dateStr(g.dateReceived)}`}>
        <Button variant="outline" size="sm" onClick={() => router.push("/grievances")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Register
        </Button>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </PageHeader>

      {/* Case flags & process position */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <GrievanceStatusBadge status={g.status} />
            <SeverityBadge severity={g.severity} />
            <OverdueBadge overdue={g.overdue} />
            <FlagBadges
              humanRightsRelated={g.humanRightsRelated}
              sensitive={g.sensitive}
              litigation={g.litigation}
              rapidResponse={g.rapidResponse}
            />
          </div>
          <ProcessStepper step={g.step} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAdvanceIntent("advance")} disabled={settled || g.step === "Follow-Up & Close"}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Advance to next step
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdvanceIntent("assign")} disabled={settled}>
              <Handshake className="mr-2 h-4 w-4" />
              Assess & assign
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setAdvanceIntent("resolve")} disabled={settled}>
              Record resolution
            </Button>
            <Button size="sm" variant="outline" onClick={() => setAdvanceIntent("close")} disabled={g.status === "Closed" || g.status === "Abandoned"}>
              Close out
            </Button>
          </div>
        </CardContent>
      </Card>

      {(g.sensitive || g.humanRightsRelated) && g.status === "Open" && (
        <Alert className="mb-4 border-warning/60 bg-warning/10">
          <AlertTitle>Sensitive grievance (§6.2)</AlertTitle>
          <AlertDescription>
            Immediately notify the Division Manager, Stakeholders Management &
            Community Development (XMD). Grievances that may adversely affect
            OERNL&apos;s reputation at a national or international level must be
            escalated to Management through the GMD.
          </AlertDescription>
        </Alert>
      )}

      {g.overdue && (
        <Alert className="mb-4 border-destructive/60 bg-destructive/10">
          <AlertTitle>Past the target resolution date</AlertTitle>
          <AlertDescription>
            {g.targetResolutionDate &&
              `Target was ${dateStr(g.targetResolutionDate)}. `}
            Issue a formal reminder to the Action Department and escalate to XMD
            if there is no response (§3.3–3.5).
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Registration record (Annex A.3 columns) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Registration record
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label="Category" value={g.category} />
              <Field label="Nature of complaint" value={g.nature} />
              <Field label="Severity" value={g.severity} />
              <Field label="Medium of receipt" value={g.medium} />
              <Field label="Complainant" value={g.complainantName} />
              <Field label="Complainant type" value={g.complainantType} />
              <Field label="Contact" value={g.complainantContact} />
              <Field label="Stakeholder group" value={g.stakeholderGroup} />
              <Field
                label="Location"
                value={[g.community, g.lga, g.state].filter(Boolean).join(", ")}
              />
              <Field label="Operational area" value={g.area} />
              <Field label="Date of complaint" value={dateStr(g.dateOfComplaint)} />
              <Field label="Date of receipt" value={dateStr(g.dateReceived)} />
              <Field label="Registering officer" value={g.registeringOfficer} />
              <Field label="Attached documentation" value={g.documentation} />
            </dl>
            {g.description && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{g.description}</p>
              </div>
            )}
            {g.remarks && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground">Remarks</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{g.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Handling & resolution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Handling & resolution</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label="Responsible department" value={g.responsibleDepartment} />
                <Field label="Grievance Owner" value={g.responsiblePerson} />
                <Field label="Action to be done" value={g.actionRequired} />
                <Field label="Target resolution" value={dateStr(g.targetResolutionDate)} />
                <Field label="Resolution level" value={g.resolutionType} />
                <Field label="Date resolved" value={dateStr(g.resolvedDate)} />
                <Field label="Closure grounds" value={g.closureType} />
                <Field label="Date closed" value={dateStr(g.closedDate)} />
              </dl>
              {g.resolutionNotes && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Resolution summary</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{g.resolutionNotes}</p>
                </div>
              )}
              {g.closureNotes && (
                <div className="mt-4">
                  <p className="text-xs text-muted-foreground">Close-out notes</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{g.closureNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Case history / audit trail */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span>Case history</span>
                <Button variant="ghost" size="sm" onClick={() => void load()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EventLog events={events} onLog={logEvent} />
            </CardContent>
          </Card>
        </div>
      </div>

      <GrievanceDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        grievance={g}
        onSaved={() => void load()}
      />
      {advanceIntent && (
        <AdvanceDialog
          open
          onOpenChange={(o) => !o && setAdvanceIntent(null)}
          grievance={g}
          intent={advanceIntent}
          onSaved={() => void load()}
        />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete grievance?"
        description={
          <>
            <Badge variant="outline" className="mr-1">
              {g.referenceNumber}
            </Badge>
            and its full case history will be permanently removed. This cannot be
            undone.
          </>
        }
        busy={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
