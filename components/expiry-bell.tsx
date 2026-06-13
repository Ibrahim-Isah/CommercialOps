"use client";

import * as React from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCertStore, expiringCount } from "@/lib/stores";

/** Top-bar bell showing the count of certificates expiring within 30 days. */
export function ExpiryBell() {
  const certificates = useCertStore((s) => s.certificates);
  const expiring = certificates
    .filter((c) => c.status === "Expiring Soon")
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  const count = expiringCount(certificates);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`${count} certificates expiring soon`}
        >
          <Bell className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold">Expiring soon</p>
            <span className="text-xs text-muted-foreground">
              within 30 days
            </span>
          </div>
          {count === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing expiring in the next 30 days.
            </p>
          ) : (
            <ul className="space-y-2">
              {expiring.slice(0, 6).map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{c.name}</span>
                  <span className="shrink-0 font-medium text-warning-foreground">
                    {c.daysRemaining}d
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/certificates"
            className="block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            View all certificates →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
