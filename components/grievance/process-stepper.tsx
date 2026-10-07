"use client";

import { Check } from "lucide-react";
import { GRIEVANCE_STEPS, type GrievanceStep } from "@/types";
import { cn } from "@/lib/utils";

/**
 * The grievance mechanism process ladder (Figure 1 of the OPI):
 * Receive & Register → Acknowledge → Assess & Assign → Investigate →
 * Respond → Follow-Up & Close. Completed steps show a check, the current
 * step the accent ring, future steps a muted outline.
 */
export function ProcessStepper({
  step,
  className,
}: {
  step: GrievanceStep;
  className?: string;
}) {
  const current = GRIEVANCE_STEPS.indexOf(step);
  return (
    <ol className={cn("flex flex-wrap items-center gap-1", className)}>
      {GRIEVANCE_STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-1">
            <span
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                done && "border-transparent bg-success/15 text-success",
                active &&
                  "border-accent bg-accent/10 text-foreground ring-1 ring-accent",
                !done && !active && "border-border text-muted-foreground"
              )}
            >
              {done ? (
                <Check className="h-3 w-3" />
              ) : (
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    active ? "bg-accent" : "bg-muted-foreground/50"
                  )}
                />
              )}
              {s}
            </span>
            {i < GRIEVANCE_STEPS.length - 1 && (
              <span
                className={cn(
                  "h-px w-3",
                  i < current ? "bg-success/50" : "bg-border"
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
