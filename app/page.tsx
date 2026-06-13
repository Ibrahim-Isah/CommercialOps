"use client";

import * as React from "react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownRight,
  ArrowUpRight,
  Ship,
  FileCheck2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { PageHeader, DemoBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { PriceChart } from "@/components/charts/price-chart";
import { StatusBadge } from "@/components/certificates/status-badge";
import { useCertStore, useWatchlistStore } from "@/lib/stores";
import { cn } from "@/lib/utils";
import type { NewsResponse, PriceSeries } from "@/types";

export default function DashboardPage() {
  const certStore = useCertStore();
  const watchStore = useWatchlistStore();

  const [price, setPrice] = React.useState<PriceSeries | null>(null);
  const [priceLoading, setPriceLoading] = React.useState(true);
  const [news, setNews] = React.useState<NewsResponse | null>(null);
  const [newsLoading, setNewsLoading] = React.useState(true);

  React.useEffect(() => {
    if (!certStore.loaded) void certStore.refresh();
    if (!watchStore.loaded) void watchStore.refresh();
    (async () => {
      try {
        const res = await fetch("/api/prices?range=30", { cache: "no-store" });
        if (res.ok) setPrice((await res.json()) as PriceSeries);
      } catch {
        /* ignore — card shows a dash */
      } finally {
        setPriceLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/news", { cache: "no-store" });
        if (res.ok) setNews((await res.json()) as NewsResponse);
      } catch {
        /* ignore */
      } finally {
        setNewsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const certs = certStore.certificates;
  const activeCount = certs.filter((c) => c.status !== "Expired").length;
  const expiring = certs
    .filter((c) => c.status === "Expiring Soon")
    .sort((a, b) => a.daysRemaining - b.daysRemaining);
  const priceUp = (price?.change ?? 0) >= 0;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Key commercial signals at a glance."
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Brent crude"
          loading={priceLoading}
          value={price ? `$${price.current.toFixed(2)}` : "—"}
          footer={
            price && (
              <span
                className={cn(
                  "flex items-center text-xs font-medium",
                  priceUp ? "text-success" : "text-destructive"
                )}
              >
                {priceUp ? (
                  <ArrowUpRight className="mr-0.5 h-3 w-3" />
                ) : (
                  <ArrowDownRight className="mr-0.5 h-3 w-3" />
                )}
                {priceUp ? "+" : ""}
                {price.change.toFixed(2)} ({priceUp ? "+" : ""}
                {price.changePercent.toFixed(2)}%)
              </span>
            )
          }
          href="/prices"
          badge={price?.isMock}
        />
        <StatCard
          label="Tracked vessels"
          loading={!watchStore.loaded}
          value={String(watchStore.vessels.length)}
          icon={<Ship className="h-4 w-4" />}
          href="/vessels"
        />
        <StatCard
          label="Active certificates"
          loading={!certStore.loaded}
          value={String(activeCount)}
          icon={<FileCheck2 className="h-4 w-4" />}
          href="/certificates"
        />
        <StatCard
          label="Expiring in 30 days"
          loading={!certStore.loaded}
          value={String(expiring.length)}
          icon={<AlertTriangle className="h-4 w-4" />}
          href="/certificates"
          highlight={expiring.length > 0}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Brent chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Brent crude — last 30 days
            </CardTitle>
            <div className="flex items-center gap-2">
              {price?.isMock && <DemoBadge />}
              <Link
                href="/prices"
                className="text-xs font-medium text-primary hover:underline"
              >
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {priceLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <PriceChart points={price?.points ?? []} height={240} />
            )}
          </CardContent>
        </Card>

        {/* Expiring soon */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Certificates expiring soon
            </CardTitle>
            <Link
              href="/certificates"
              className="text-xs font-medium text-primary hover:underline"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {!certStore.loaded ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : expiring.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing expiring in the next 30 days.
              </p>
            ) : (
              <ul className="space-y-2">
                {expiring.slice(0, 5).map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.daysRemaining} days left
                      </p>
                    </div>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Latest news */}
      <Card className="mt-6">
        <CardHeader className="flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Latest industry updates
          </CardTitle>
          <div className="flex items-center gap-2">
            {news?.isMock && <DemoBadge />}
            <Link
              href="/news"
              className="flex items-center text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="ml-0.5 h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {newsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {(news?.items ?? []).slice(0, 4).map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-md border p-3 transition-colors hover:bg-secondary/50"
                >
                  <p className="line-clamp-2 text-sm font-medium group-hover:underline">
                    {item.title}
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <span className="truncate">{item.source}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </div>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  footer,
  icon,
  href,
  loading,
  highlight,
  badge,
}: {
  label: string;
  value: string;
  footer?: React.ReactNode;
  icon?: React.ReactNode;
  href: string;
  loading?: boolean;
  highlight?: boolean;
  badge?: boolean;
}) {
  return (
    <Link href={href}>
      <Card
        className={cn(
          "transition-colors hover:border-accent/60",
          highlight && "border-warning/60"
        )}
      >
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {label}
          </CardTitle>
          {icon && <span className="text-muted-foreground">{icon}</span>}
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{value}</span>
                {badge && <DemoBadge />}
              </div>
              {footer && <div className="mt-1">{footer}</div>}
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
