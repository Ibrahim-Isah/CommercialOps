"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Gauge } from "lucide-react";
import { NAV_ITEMS, type NavEntry, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function NavLink({
  item,
  pathname,
  onNavigate,
  nested = false,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const active = isActive(pathname, item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        nested && "pl-9",
        active
          ? "bg-secondary text-secondary-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", nested && "h-4 w-4", active && "text-accent")} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function NavGroup({
  entry,
  pathname,
  onNavigate,
}: {
  entry: NavEntry & { children: NavItem[] };
  pathname: string;
  onNavigate?: () => void;
}) {
  const storageKey = `nav-group:${entry.label}`;
  const childActive = entry.children.some((c) => isActive(pathname, c.href));
  // null until hydrated, so server and first client render agree (avoids a
  // hydration mismatch from reading localStorage during render).
  const [stored, setStored] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const raw = window.localStorage.getItem(storageKey);
    if (raw !== null) setStored(raw === "1");
  }, [storageKey]);

  const open = stored ?? childActive;
  const Icon = entry.icon;

  function toggle() {
    const next = !open;
    setStored(next);
    window.localStorage.setItem(storageKey, next ? "1" : "0");
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          childActive
            ? "text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
        )}
      >
        <Icon className={cn("h-5 w-5 shrink-0", childActive && "text-accent")} />
        <span className="flex-1 truncate text-left">{entry.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="mt-1 space-y-1">
          {entry.children.map((child) => (
            <NavLink
              key={child.href}
              item={child}
              pathname={pathname}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Gauge className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Commercial Ops</p>
          <p className="text-xs text-muted-foreground">Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((entry) =>
          entry.children ? (
            <NavGroup
              key={entry.label}
              entry={entry as NavEntry & { children: NavItem[] }}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ) : (
            <NavLink
              key={entry.href}
              item={entry as NavItem}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          )
        )}
      </nav>

      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">
          Internal tool. Data may include demo fallbacks.
        </p>
      </div>
    </div>
  );
}
