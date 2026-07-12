"use client";

import * as React from "react";
import { formatDistanceToNow, format } from "date-fns";
import { ExternalLink, RefreshCw, Newspaper, Search } from "lucide-react";
import { PageHeader, ErrorState, EmptyState, DemoBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { NewsCategory, NewsResponse } from "@/types";

const FILTERS: Array<{ key: "All" | NewsCategory; label: string }> = [
  { key: "All", label: "All" },
  { key: "Nigeria", label: "🇳🇬 Nigeria" },
  { key: "Crude", label: "Crude" },
  { key: "Gas/LNG", label: "Gas/LNG" },
  { key: "OPEC", label: "OPEC" },
  { key: "Regulatory", label: "Regulatory" },
];

export default function NewsPage() {
  const [data, setData] = React.useState<NewsResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [filter, setFilter] = React.useState<"All" | NewsCategory>("All");
  const [query, setQuery] = React.useState("");

  const load = React.useCallback(async (refresh = false) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/news${refresh ? "?refresh=1" : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      setData((await res.json()) as NewsResponse);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const items = (data?.items ?? []).filter(
    (i) =>
      (filter === "All" || i.categories.includes(filter)) &&
      (q === "" ||
        i.title.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.source.toLowerCase().includes(q))
  );

  return (
    <div>
      <PageHeader
        title="Industry Updates"
        description="Nigerian oil & gas news first, then global market headlines — from Nigerian outlets, Africa Oil+Gas Report, NewsAPI, OilPrice.com and EIA feeds."
      >
        {data?.isMock && <DemoBadge />}
        <Button
          variant="outline"
          size="sm"
          onClick={() => void load(true)}
          disabled={loading}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </PageHeader>

      <div className="relative mb-4 sm:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search headlines by keyword or source"
          className="pl-9"
          aria-label="Search headlines"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.key}
              variant={filter === f.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        {data && (
          <p className="text-xs text-muted-foreground">
            Last updated {format(new Date(data.fetchedAt), "d MMM yyyy, HH:mm")}
          </p>
        )}
      </div>

      {error ? (
        <ErrorState message="Could not load the news feed." onRetry={() => void load(true)} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          message={
            q
              ? `No headlines match “${query.trim()}” right now.`
              : "No headlines match this filter right now."
          }
          icon={<Newspaper className="h-8 w-8 text-muted-foreground" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {item.categories.map((c) => (
                    <Badge
                      key={c}
                      // Nigeria stories carry a distinct badge so they stand
                      // out in the mixed feed.
                      variant={c === "Nigeria" ? "success" : "secondary"}
                      className="text-[10px]"
                    >
                      {c === "Nigeria" ? "🇳🇬 Nigeria" : c}
                    </Badge>
                  ))}
                </div>
                <CardTitle className="text-base leading-snug">
                  {item.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                {item.description && (
                  <p className="mb-3 line-clamp-3 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
                  <span className="truncate">
                    {item.source} ·{" "}
                    {(() => {
                      try {
                        return formatDistanceToNow(new Date(item.publishedAt), {
                          addSuffix: true,
                        });
                      } catch {
                        return "recently";
                      }
                    })()}
                  </span>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex shrink-0 items-center gap-1 font-medium text-primary hover:underline"
                  >
                    Read <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
