/**
 * Read-time derivations for grievances: list enrichment (overdue awareness)
 * and the step ladder used by the case workflow UI.
 */
import { differenceInCalendarDays, parseISO } from "date-fns";
import { GRIEVANCE_STEPS, type Grievance, type GrievanceWithMeta } from "@/types";

/** Statuses that stop the overdue clock. */
const SETTLED: ReadonlySet<string> = new Set(["Resolved", "Closed", "Abandoned"]);

export function isSettled(g: Pick<Grievance, "status">): boolean {
  return SETTLED.has(g.status);
}

export function withMeta(g: Grievance, now: Date = new Date()): GrievanceWithMeta {
  const daysOpen = differenceInCalendarDays(now, parseISO(g.dateReceived));
  const daysToTarget = g.targetResolutionDate
    ? differenceInCalendarDays(parseISO(g.targetResolutionDate), now)
    : undefined;
  return {
    ...g,
    daysOpen,
    daysToTarget,
    overdue:
      daysToTarget !== undefined && daysToTarget < 0 && !isSettled(g),
  };
}

export function decorate(
  grievances: Grievance[],
  now: Date = new Date()
): GrievanceWithMeta[] {
  return grievances.map((g) => withMeta(g, now));
}

/** Zero-based position of a step in the process ladder (Figure 1). */
export function stepIndex(step: Grievance["step"]): number {
  return GRIEVANCE_STEPS.indexOf(step);
}
