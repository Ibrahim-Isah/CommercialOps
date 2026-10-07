"use client";

import * as React from "react";
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  ClipboardList,
  Handshake,
  History,
  MessageSquare,
  Send,
  Siren,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { GrievanceEvent, GrievanceEventType } from "@/types";
import { cn } from "@/lib/utils";

const EVENT_META: Record<
  GrievanceEventType,
  { label: string; Icon: typeof History }
> = {
  registered: { label: "Registered", Icon: ClipboardList },
  acknowledged: { label: "Acknowledged", Icon: UserCheck },
  assigned: { label: "Assigned", Icon: Handshake },
  "step-change": { label: "Process step", Icon: ArrowRightLeft },
  engagement: { label: "Engagement", Icon: MessageSquare },
  reminder: { label: "Reminder", Icon: AlertTriangle },
  escalation: { label: "Escalation", Icon: Siren },
  response: { label: "Response issued", Icon: Send },
  resolution: { label: "Resolved", Icon: CheckCircle2 },
  closure: { label: "Closed out", Icon: CheckCircle2 },
  note: { label: "Note", Icon: History },
};

/** Quick log types offered on the case page (§3.1 Engagement During Investigation). */
export const LOGGABLE_EVENTS: Array<{
  type: GrievanceEventType;
  label: string;
  placeholder: string;
}> = [
  {
    type: "engagement",
    label: "Engagement update",
    placeholder:
      "Contact with the complainant — meeting, call, site visit… (kept in the Feedback Register / MoM)",
  },
  {
    type: "reminder",
    label: "Reminder issued",
    placeholder: "Formal reminder to the Action Department for non-response (§3.3)…",
  },
  {
    type: "escalation",
    label: "Escalation",
    placeholder: "Escalated to XMD / GMD — reason and outcome (§3.4–3.7)…",
  },
  {
    type: "note",
    label: "General note",
    placeholder: "Anything worth recording on this case…",
  },
];

/**
 * Case history: the audit trail of every action taken (§7 traceability),
 * plus a quick-log form for engagement activity during investigation.
 */
export function EventLog({
  events,
  onLog,
}: {
  events: GrievanceEvent[];
  onLog: (type: GrievanceEventType, note: string, actor: string) => Promise<void>;
}) {
  const [type, setType] = React.useState<GrievanceEventType>("engagement");
  const [note, setNote] = React.useState("");
  const [actor, setActor] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const meta = LOGGABLE_EVENTS.find((e) => e.type === type);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setBusy(true);
    try {
      await onLog(type, note.trim(), actor.trim());
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="rounded-lg border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {LOGGABLE_EVENTS.map((e) => (
            <Button
              key={e.type}
              type="button"
              variant={type === e.type ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setType(e.type)}
            >
              {React.createElement(EVENT_META[e.type].Icon, {
                className: "mr-1 h-3 w-3",
              })}
              {e.label}
            </Button>
          ))}
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder={meta?.placeholder}
          className="mb-2 min-h-[60px] text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={actor}
            onChange={(e) => setActor(e.target.value)}
            placeholder="Recorded by"
            className="h-8 w-40 rounded-md border border-input bg-transparent px-2.5 text-xs"
          />
          <Button type="submit" size="sm" disabled={busy || !note.trim()}>
            {busy ? "Logging…" : "Log entry"}
          </Button>
        </div>
      </form>

      <ol className="space-y-3">
        {events.map((ev) => {
          const { label, Icon } = EVENT_META[ev.type];
          return (
            <li key={ev.id} className="flex gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-secondary/60">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(parseISO(ev.createdAt), "d MMM yyyy, HH:mm")}
                    {ev.actor ? ` · ${ev.actor}` : ""}
                  </span>
                </div>
                {ev.note && (
                  <p className={cn("mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground")}>
                    {ev.note}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
