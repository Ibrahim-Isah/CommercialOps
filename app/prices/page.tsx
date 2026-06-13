"use client";

import * as React from "react";
import { format } from "date-fns";
import { ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { PageHeader, ErrorState, DemoBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PriceChart } from "@/components/charts/price-chart";
import { cn } from "@/lib/utils";
import type { PriceSeries } from "@/types";

const RANGES = [
  { key: "30", label: "30D" },
  { key: "90", label: "90D" },
  { key: "365", label: "1Y" },
];

export default function PricesPage() {
  const [range, setRange] = React.useState("30");
  const [data, setData] = React.useState<PriceSeries | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async (r: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/prices?range=${r}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData((await res.json()) as PriceSeries);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(range);
  }, [range, load]);

  const up = (data?.change ?? 0) >= 0;

  return (
    <div>
      <PageHeader
        title="Oil Prices"
        description="Europe Brent crude spot price (EIA, series RBRTE)."
      >
        {data?.isMock && <DemoBadge />}
        <Button
          variant="outline"
          size="icon"
          aria-label="Refresh prices"
          onClick={() => void load(range)}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </PageHeader>

      {error ? (
        <ErrorState
          message="Could not load price data."
          onRetry={() => void load(range)}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Current Brent
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-10 w-32" />
                ) : (
                  <>
                    <div className="text-3xl font-bold">
                      ${data?.current.toFixed(2)}
                      <span className="ml-1 text-base font-normal text-muted-foreground">
                        /bbl
                      </span>
                    </div>
                    <div
                      className={cn(
                        "mt-1 flex items-center text-sm font-medium",
                        up ? "text-success" : "text-destructive"
                      )}
                    >
                      {up ? (
                        <ArrowUpRight className="mr-1 h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="mr-1 h-4 w-4" />
                      )}
                      {up ? "+" : ""}
                      {data?.change.toFixed(2)} ({up ? "+" : ""}
                      {data?.changePercent.toFixed(2)}%)
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Price history
                </CardTitle>
                <Tabs value={range} onValueChange={setRange}>
                  <TabsList>
                    {RANGES.map((r) => (
                      <TabsTrigger key={r.key} value={r.key}>
                        {r.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[280px] w-full" />
                ) : (
                  <PriceChart points={data?.points ?? []} />
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Window statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat
                  label="Period high"
                  value={data ? `$${data.high.toFixed(2)}` : "—"}
                  loading={loading}
                />
                <Stat
                  label="Period low"
                  value={data ? `$${data.low.toFixed(2)}` : "—"}
                  loading={loading}
                />
                <Stat
                  label="Average"
                  value={data ? `$${data.average.toFixed(2)}` : "—"}
                  loading={loading}
                />
                <Stat
                  label="Volatility (σ)"
                  value={data ? `$${data.volatility.toFixed(2)}` : "—"}
                  loading={loading}
                />
              </div>
              {data && (
                <p className="mt-4 text-xs text-muted-foreground">
                  Last updated {format(new Date(data.fetchedAt), "d MMM yyyy, HH:mm")}.
                  {data.isMock
                    ? " Showing demo data — add EIA_API_KEY for live prices."
                    : " Live data from the EIA API, cached up to 1 hour."}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-20" />
      ) : (
        <p className="text-xl font-semibold">{value}</p>
      )}
    </div>
  );
}
