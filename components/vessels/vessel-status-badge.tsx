"use client";

import { Badge } from "@/components/ui/badge";
import type { VesselStatus } from "@/types";

function variantFor(
  status: VesselStatus
): "success" | "secondary" | "warning" | "outline" {
  switch (status) {
    case "Under way using engine":
      return "success";
    case "At anchor":
    case "Moored":
      return "secondary";
    case "Unknown":
      return "outline";
    default:
      // Restricted, constrained, aground, not under command.
      return "warning";
  }
}

export function VesselStatusBadge({
  status,
  className,
}: {
  status: VesselStatus;
  className?: string;
}) {
  return (
    <Badge variant={variantFor(status)} className={className}>
      {status}
    </Badge>
  );
}
