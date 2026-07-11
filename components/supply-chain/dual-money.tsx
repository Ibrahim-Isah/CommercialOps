"use client";

import { cn } from "@/lib/utils";
import { formatNaira, formatUsd } from "@/lib/supply-chain/derive";

/**
 * Renders a project amount that may exist in ₦, $, or both (split contracts).
 * Each currency gets its own line; `signed` colours each line by its sign
 * (used for savings, where one currency can save while the other overruns).
 */
export function DualMoney({
  ngn,
  usd,
  signed = false,
  className,
}: {
  ngn?: number;
  usd?: number;
  signed?: boolean;
  className?: string;
}) {
  const hasNgn = ngn !== undefined && ngn !== null;
  const hasUsd = usd !== undefined && usd !== null;
  if (!hasNgn && !hasUsd) {
    return <span className="text-muted-foreground">—</span>;
  }
  const signClass = (v: number) =>
    signed ? (v >= 0 ? "text-success" : "text-destructive") : undefined;
  return (
    <span className={cn("inline-flex flex-col", className)}>
      {hasNgn && (
        <span className={cn("whitespace-nowrap", signClass(ngn as number))}>
          {formatNaira(ngn as number)}
        </span>
      )}
      {hasUsd && (
        <span className={cn("whitespace-nowrap", signClass(usd as number))}>
          {formatUsd(usd as number)}
        </span>
      )}
    </span>
  );
}
