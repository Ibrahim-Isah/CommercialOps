"use client";

import { Badge } from "@/components/ui/badge";
import {
  INDIGENOUS_EQUITY_THRESHOLD,
  NIGERIAN_CONTENT_TARGET,
} from "@/lib/supply-chain/derive";
import type {
  SupplyProjectStatus,
  VendorDocumentStatus,
  VendorStatus,
} from "@/types";

type Variant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning";

const PROJECT_STATUS_VARIANTS: Record<SupplyProjectStatus, Variant> = {
  ongoing: "success",
  completed: "secondary",
  delayed: "warning",
  cancelled: "outline",
  expired: "destructive",
};

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: SupplyProjectStatus;
  className?: string;
}) {
  return (
    <Badge variant={PROJECT_STATUS_VARIANTS[status]} className={className}>
      {status}
    </Badge>
  );
}

const VENDOR_STATUS_VARIANTS: Record<VendorStatus, Variant> = {
  active: "success",
  suspended: "warning",
  blacklisted: "destructive",
  inactive: "outline",
};

export function VendorStatusBadge({
  status,
  className,
}: {
  status: VendorStatus;
  className?: string;
}) {
  return (
    <Badge variant={VENDOR_STATUS_VARIANTS[status]} className={className}>
      {status}
    </Badge>
  );
}

const DOC_STATUS_VARIANTS: Record<VendorDocumentStatus, Variant> = {
  Valid: "success",
  "Expiring Soon": "warning",
  Expired: "destructive",
};

export function DocumentStatusBadge({
  status,
  className,
}: {
  status: VendorDocumentStatus;
  className?: string;
}) {
  return (
    <Badge variant={DOC_STATUS_VARIANTS[status]} className={className}>
      {status}
    </Badge>
  );
}

/** 51%+ Nigerian equity marks an indigenous company under NOGICD. */
export function IndigenousBadge({ equity }: { equity?: number }) {
  if (equity === undefined || equity < INDIGENOUS_EQUITY_THRESHOLD) return null;
  return (
    <Badge variant="outline" className="text-[10px]">
      Indigenous
    </Badge>
  );
}

/** Compliance flag for projects below the Nigerian content target. */
export function NigerianContentBadge({ percentage }: { percentage?: number }) {
  if (percentage === undefined) return null;
  if (percentage >= NIGERIAN_CONTENT_TARGET) {
    return <Badge variant="success">{percentage}% NC</Badge>;
  }
  return (
    <Badge variant="warning" title={`Below the ${NIGERIAN_CONTENT_TARGET}% Nigerian content target`}>
      {percentage}% NC — below target
    </Badge>
  );
}
