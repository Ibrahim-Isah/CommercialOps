"use client";

import { Badge } from "@/components/ui/badge";
import type {
  GrievanceSeverity,
  GrievanceStatus,
} from "@/types";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

const SEVERITY_VARIANTS: Record<GrievanceSeverity, Variant> = {
  Low: "outline",
  Medium: "warning",
  High: "destructive",
};

export function SeverityBadge({
  severity,
  className,
}: {
  severity: GrievanceSeverity;
  className?: string;
}) {
  return (
    <Badge variant={SEVERITY_VARIANTS[severity]} className={className}>
      {severity}
    </Badge>
  );
}

const STATUS_VARIANTS: Record<GrievanceStatus, Variant> = {
  Open: "warning",
  Resolved: "success",
  Closed: "secondary",
  Abandoned: "outline",
};

export function GrievanceStatusBadge({
  status,
  className,
}: {
  status: GrievanceStatus;
  className?: string;
}) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={className}>
      {status}
    </Badge>
  );
}

/** Flags from the OPI: human-rights cases (§6.3), sensitive (§6.2), litigation. */
export function FlagBadges({
  humanRightsRelated,
  sensitive,
  litigation,
  rapidResponse,
}: {
  humanRightsRelated: boolean;
  sensitive: boolean;
  litigation: boolean;
  rapidResponse: boolean;
}) {
  return (
    <>
      {humanRightsRelated && (
        <Badge variant="destructive" className="text-[10px]">
          Human rights
        </Badge>
      )}
      {sensitive && (
        <Badge variant="warning" className="text-[10px]">
          Sensitive
        </Badge>
      )}
      {litigation && (
        <Badge variant="outline" className="text-[10px]">
          Litigation
        </Badge>
      )}
      {rapidResponse && (
        <Badge variant="success" className="text-[10px]">
          Rapid response
        </Badge>
      )}
    </>
  );
}

/** Overdue target-resolution flag (past the agreed duration, still open). */
export function OverdueBadge({ overdue }: { overdue: boolean }) {
  if (!overdue) return null;
  return (
    <Badge variant="destructive" className="text-[10px]">
      overdue
    </Badge>
  );
}
