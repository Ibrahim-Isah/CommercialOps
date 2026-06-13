"use client";

import * as React from "react";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { PageHeader, ErrorState, DemoBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { cn } from "@/lib/utils";
import type { ForecastResult } from "@/types";

const HORIZONS = [
  { key: "7", label: "7 days" },
  { key: "14", label: "14 days" },
  { key: "30", label: "30 days" },
];

export default function ForecastPage() {
  const [horizon, setHorizon] = React.useState("14");
  const [data, setData] = React.useState<ForecastResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(async (h: string) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(`/api/forecast?horizon=${h}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      setData((await res.json()) as ForecastResult);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load(horizon);
  }, [horizon, load]);

  const rising = (data?.trendPerDay ?? 0) >= 0;
  const lastForecast = data?.points.filter((p) => p.forecast !== undefined).at(-1);

  return (
    <div>
      <PageHeader
        title="Forecast"
        description="A simple, transparent statistical projection of Brent crude."
      >
        {data?.isMock && <DemoBadge />}
      </PageHeader>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Statistical estimate only — not financial advice</AlertTitle>
        <AlertDescription>
          This projection is for internal awareness, not trading or investment
          decisions. {data?.method}
        </AlertDescription>
      </Alert>

      {error ? (
        <ErrorState
          message="Could not build the forecast."
          onRetry={() => void load(horizon)}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  <div
                    className={cn(
                      "flex items-center text-xl font-semibold",
                      rising ? "text-success" : "text-destructive"
                    )}
                  >
                    {rising ? (
                      <TrendingUp className="mr-2 h-5 w-5" />
                    ) : (
                      <TrendingDown className="mr-2 h-5 w-5" />
                    )}
                    {rising ? "+" : ""}
                    {data?.trendPerDay.toFixed(3)} $/day
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Projected in {horizon} days
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  <div className="text-xl font-semibold">
                    {lastForecast?.forecast !== undefined
                      ? `$${lastForecast.forecast.toFixed(2)}`
                      : "—"}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Confidence band
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-8 w-28" />
                ) : (
                  <div className="text-sm text-muted-foreground">
                    {lastForecast?.lower !== undefined &&
                    lastForecast?.upper !== undefined
                      ? `$${lastForecast.lower.toFixed(2)} – $${lastForecast.upper.toFixed(2)}`
                      : "—"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {data?.label ?? "Brent"} — actuals and projection
              </CardTitle>
              <Tabs value={horizon} onValueChange={setHorizon}>
                <TabsList>
                  {HORIZONS.map((h) => (
                    <TabsTrigger key={h.key} value={h.key}>
                      {h.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[320px] w-full" />
              ) : (
                <>
                  <ForecastChart points={data?.points ?? []} />
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-0.5 w-5 bg-foreground" />
                      Actual
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-accent" />
                      Forecast
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-3 w-5 rounded-sm bg-accent/20" />
                      Confidence band
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
