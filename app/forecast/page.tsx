"use client";

import * as React from "react";
import { ChevronDown, Flame, Fuel, Info, SlidersHorizontal } from "lucide-react";
import { PageHeader, ErrorState, DemoBadge } from "@/components/common";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FanChart, type ReferenceSeries } from "@/components/charts/fan-chart";
import {
  BENCHMARK_META,
  GasBenchmarksChart,
} from "@/components/charts/gas-benchmarks-chart";
import { buildFanForecast } from "@/lib/forecast-engine";
import { cn } from "@/lib/utils";
import type {
  GasBenchmarkKey,
  GasData,
  PiaSector,
  PriceSeries,
} from "@/types";

const UPPER_PRESETS = [75, 85, 90, 95];
const LOWER_PRESETS = [5, 10, 25];

const SECTOR_LABELS: Record<PiaSector, string> = {
  power: "Power (DBP)",
  commercial: "Commercial",
  gas_based_industries: "Gas-based industries (band)",
};

/** Parse an optional numeric input; empty/invalid means "not set". */
function optFloat(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function StatCard({
  title,
  value,
  hint,
  loading,
}: {
  title: string;
  value: React.ReactNode;
  hint?: string;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <>
            <div className="text-xl font-semibold">{value}</div>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PercentileSelect({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: number;
  presets: number[];
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {label}
      </span>
      <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
        <SelectTrigger className="h-8 w-[90px] text-xs" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {presets.map((p) => (
            <SelectItem key={p} value={String(p)}>
              {p}th
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function CollapsibleCard({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-6 py-4 text-left"
      >
        {icon}
        <span className="flex-1 text-sm font-medium">{title}</span>
        <ChevronDown
          className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}

export default function ForecastPage() {
  // ---- global controls ----
  const [horizon, setHorizon] = React.useState<5 | 10>(5);
  const [nairaOn, setNairaOn] = React.useState(false);
  const [nairaRate, setNairaRate] = React.useState("1500");

  // ---- oil controls ----
  const [oilUpper, setOilUpper] = React.useState(85);
  const [oilLower, setOilLower] = React.useState(25);
  const [showNigerian, setShowNigerian] = React.useState(false);
  const [differential, setDifferential] = React.useState("0.5");

  // ---- gas controls ----
  const [gasUpper, setGasUpper] = React.useState(85);
  const [gasLower, setGasLower] = React.useState(25);
  const [gasBenchmark, setGasBenchmark] =
    React.useState<GasBenchmarkKey>("henry_hub");
  const [sector, setSector] = React.useState<PiaSector>("power");
  const [visible, setVisible] = React.useState<Record<GasBenchmarkKey, boolean>>(
    { henry_hub: true, ttf: true, jkm: true }
  );

  // ---- assumptions (blank = data-driven default) ----
  const [oilGrowth, setOilGrowth] = React.useState("");
  const [oilAnchor, setOilAnchor] = React.useState("");
  const [oilVolMult, setOilVolMult] = React.useState("1");
  const [gasGrowth, setGasGrowth] = React.useState("");
  const [gasAnchor, setGasAnchor] = React.useState("");
  const [gasVolMult, setGasVolMult] = React.useState("1");
  const [assumptionsOpen, setAssumptionsOpen] = React.useState(false);
  const [methodOpen, setMethodOpen] = React.useState(false);

  // ---- data ----
  const [oil, setOil] = React.useState<PriceSeries | null>(null);
  const [oilError, setOilError] = React.useState(false);
  const [gas, setGas] = React.useState<GasData | null>(null);
  const [gasError, setGasError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setLoading(true);
    setOilError(false);
    setGasError(null);
    const [oilRes, gasRes] = await Promise.allSettled([
      fetch("/api/prices?range=365", { cache: "no-store" }),
      fetch("/api/gas", { cache: "no-store" }),
    ]);
    if (oilRes.status === "fulfilled" && oilRes.value.ok) {
      setOil((await oilRes.value.json()) as PriceSeries);
    } else {
      setOilError(true);
    }
    if (gasRes.status === "fulfilled") {
      const body = (await gasRes.value.json()) as GasData & { error?: string };
      if (gasRes.value.ok) setGas(body);
      else setGasError(body.error ?? "Could not load gas price data.");
    } else {
      setGasError("Could not load gas price data.");
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // ---- derived forecasts (all client-side, so controls redraw instantly) ----
  const oilFan = React.useMemo(() => {
    if (!oil) return null;
    return buildFanForecast(oil.points, {
      horizonYears: horizon,
      upperPercentile: oilUpper,
      lowerPercentile: oilLower,
      growthOverride:
        optFloat(oilGrowth) !== null ? optFloat(oilGrowth)! / 100 : null,
      terminalAnchor: optFloat(oilAnchor),
      volatilityMultiplier: optFloat(oilVolMult) ?? 1,
    });
  }, [oil, horizon, oilUpper, oilLower, oilGrowth, oilAnchor, oilVolMult]);

  const nigerianLine = React.useMemo(() => {
    if (!oilFan || !showNigerian) return undefined;
    const diff = optFloat(differential) ?? 0;
    return {
      name: "Nigerian crude (Brent − differential)",
      points: oilFan.points.map((p) => ({
        date: p.date,
        value: Math.round((p.central - diff) * 100) / 100,
      })),
    };
  }, [oilFan, showNigerian, differential]);

  const gasHistory = gas?.series[gasBenchmark] ?? [];
  const gasFan = React.useMemo(() => {
    if (gasHistory.length === 0) return null;
    return buildFanForecast(gasHistory, {
      horizonYears: horizon,
      upperPercentile: gasUpper,
      lowerPercentile: gasLower,
      growthOverride:
        optFloat(gasGrowth) !== null ? optFloat(gasGrowth)! / 100 : null,
      terminalAnchor: optFloat(gasAnchor),
      volatilityMultiplier: optFloat(gasVolMult) ?? 1,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gas, gasBenchmark, horizon, gasUpper, gasLower, gasGrowth, gasAnchor, gasVolMult]);

  // PIA reference for the selected sector, sorted by effective date. Future
  // values are unknown (set annually), so the stepped line holds the latest
  // value flat across the forecast horizon.
  const piaReference: ReferenceSeries | undefined = React.useMemo(() => {
    const rows = (gas?.pia ?? [])
      .filter((p) => p.sector === sector)
      .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate));
    if (rows.length === 0) return undefined;
    return {
      name: `Nigeria PIA — ${SECTOR_LABELS[sector]}`,
      points: rows.map((p) => ({
        date: p.effectiveDate,
        value: p.priceUsdMmbtu,
        floor: p.floorUsdMmbtu,
      })),
    };
  }, [gas, sector]);

  const currentPia = piaReference?.points
    .filter((p) => p.date <= new Date().toISOString().slice(0, 10))
    .at(-1);

  // ---- money display (cards convert to ₦ when toggled; charts stay in USD) ----
  const rate = optFloat(nairaRate) ?? 1500;
  const money = (v: number | undefined, digits = 2): string => {
    if (v === undefined) return "—";
    if (nairaOn) {
      return `₦${(v * rate).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
    }
    return `$${v.toFixed(digits)}`;
  };

  const oilLast = oilFan?.points.at(-1);
  const gasLast = gasFan?.points.at(-1);
  const gasCurrent = gasHistory.at(-1)?.price;

  const bandCaption = (upper: number, lower: number) =>
    `The central line is the expected path. The upper (optimistic) band is the ` +
    `level prices stay below in ${upper}% of scenarios; the lower (conservative) ` +
    `band is the ${lower}th-percentile floor.`;

  return (
    <div>
      <PageHeader
        title="Oil & Gas Forecast"
        description="Brent-based oil outlook and global gas benchmarks against Nigeria's regulated PIA gas price."
      >
        {oil?.isMock && <DemoBadge />}
        <Tabs
          value={String(horizon)}
          onValueChange={(v) => setHorizon(Number(v) as 5 | 10)}
        >
          <TabsList>
            <TabsTrigger value="5">5 years</TabsTrigger>
            <TabsTrigger value="10">10 years</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant={nairaOn ? "secondary" : "outline"}
          size="sm"
          onClick={() => setNairaOn((v) => !v)}
        >
          ₦ Naira
        </Button>
        {nairaOn && (
          <Input
            type="number"
            min={1}
            value={nairaRate}
            onChange={(e) => setNairaRate(e.target.value)}
            className="h-9 w-24"
            aria-label="Naira per US dollar"
            title="₦ per $ — edit to your working rate"
          />
        )}
      </PageHeader>

      <Alert className="mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Statistical projection — not financial advice</AlertTitle>
        <AlertDescription>
          Both forecasts extend the historical trend with a widening
          uncertainty band. Use the assumptions panel at the bottom to
          sanity-check long horizons.
          {nairaOn && ` Cards are converted at ₦${rate.toLocaleString()}/$; charts stay in USD.`}
        </AlertDescription>
      </Alert>

      {/* ------------------------------ OIL ------------------------------ */}
      <div className="mb-3 flex items-center gap-2">
        <Fuel className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-semibold">Oil — Brent crude</h3>
      </div>

      {oilError ? (
        <ErrorState
          message="Could not load the Brent price history."
          onRetry={() => void load()}
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Current Brent"
              value={money(oil?.current)}
              hint="per barrel"
              loading={loading}
            />
            <StatCard
              title={`Projected in ${horizon} years`}
              value={money(oilLast?.central)}
              hint="central path"
              loading={loading}
            />
            <StatCard
              title="Expected range at horizon"
              value={
                oilLast ? `${money(oilLast.lower)} – ${money(oilLast.upper)}` : "—"
              }
              hint={`${oilLower}th to ${oilUpper}th percentile`}
              loading={loading}
            />
            <StatCard
              title="Implied annual growth"
              value={
                oilFan ? `${(oilFan.cagr * 100).toFixed(1)}% /yr` : "—"
              }
              hint="CAGR of the central path"
              loading={loading}
            />
          </div>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Brent — history and {horizon}-year fan forecast ($/bbl)
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <PercentileSelect
                  label="Upper (optimistic)"
                  value={oilUpper}
                  presets={UPPER_PRESETS}
                  onChange={setOilUpper}
                />
                <PercentileSelect
                  label="Lower (conservative)"
                  value={oilLower}
                  presets={LOWER_PRESETS}
                  onChange={setOilLower}
                />
                <Button
                  variant={showNigerian ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowNigerian((v) => !v)}
                >
                  Nigerian crude
                </Button>
                {showNigerian && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">− $</span>
                    <Input
                      type="number"
                      step={0.1}
                      value={differential}
                      onChange={(e) => setDifferential(e.target.value)}
                      className="h-8 w-20 text-xs"
                      aria-label="Nigerian grade differential vs Brent"
                      title="Differential vs Brent in $/bbl (negative = premium)"
                    />
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[340px] w-full" />
              ) : (
                <>
                  <FanChart
                    history={oil?.points ?? []}
                    forecast={oilFan?.points ?? []}
                    unitLabel="bbl"
                    bandLabel={`${oilLower}th–${oilUpper}th percentile band`}
                    extraLine={nigerianLine}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {bandCaption(oilUpper, oilLower)}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ------------------------------ GAS ------------------------------ */}
      <div className="mb-3 mt-10 flex items-center gap-2 border-t pt-8">
        <Flame className="h-5 w-5 text-warning" />
        <h3 className="text-lg font-semibold">
          Gas — global benchmarks & Nigeria PIA
        </h3>
      </div>

      {gasError ? (
        <ErrorState message={gasError} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Global benchmark history ($/MMBtu)
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(BENCHMARK_META) as GasBenchmarkKey[]).map((key) => (
                  <Button
                    key={key}
                    variant={visible[key] ? "secondary" : "outline"}
                    size="sm"
                    onClick={() =>
                      setVisible((v) => ({ ...v, [key]: !v[key] }))
                    }
                  >
                    {BENCHMARK_META[key].label}
                  </Button>
                ))}
                <Select
                  value={sector}
                  onValueChange={(v) => setSector(v as PiaSector)}
                >
                  <SelectTrigger
                    className="h-8 w-[220px] text-xs"
                    aria-label="PIA sector"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SECTOR_LABELS) as PiaSector[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        PIA: {SECTOR_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <>
                  <GasBenchmarksChart
                    series={
                      gas?.series ?? { henry_hub: [], ttf: [], jkm: [] }
                    }
                    visible={visible}
                    reference={piaReference}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Henry Hub, TTF and JKM are the three main global gas
                    benchmarks (US, Europe, Asia LNG). Nigeria&apos;s LNG
                    exports are exposed to TTF and JKM, while the domestic
                    market is regulated — the dashed stepped line is the PIA
                    price set annually by the NMDPRA, not a market price.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title={`Current ${BENCHMARK_META[gasBenchmark].label}`}
              value={money(gasCurrent)}
              hint="per MMBtu"
              loading={loading}
            />
            <StatCard
              title={`PIA — ${SECTOR_LABELS[sector]}`}
              value={
                currentPia
                  ? currentPia.floor !== undefined
                    ? `${money(currentPia.floor)} – ${money(currentPia.value)}`
                    : money(currentPia.value)
                  : "—"
              }
              hint="regulated domestic price"
              loading={loading}
            />
            <StatCard
              title={`Projected in ${horizon} years`}
              value={money(gasLast?.central)}
              hint="central path"
              loading={loading}
            />
            <StatCard
              title="Expected range at horizon"
              value={
                gasLast ? `${money(gasLast.lower)} – ${money(gasLast.upper)}` : "—"
              }
              hint={`${gasLower}th to ${gasUpper}th percentile`}
              loading={loading}
            />
          </div>

          <Card>
            <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Gas forecast ($/MMBtu) vs the PIA regulated price
              </CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={gasBenchmark}
                  onValueChange={(v) => setGasBenchmark(v as GasBenchmarkKey)}
                >
                  <SelectTrigger
                    className="h-8 w-[170px] text-xs"
                    aria-label="Benchmark to forecast"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(BENCHMARK_META) as GasBenchmarkKey[]).map(
                      (key) => (
                        <SelectItem key={key} value={key}>
                          {BENCHMARK_META[key].label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
                <PercentileSelect
                  label="Upper"
                  value={gasUpper}
                  presets={UPPER_PRESETS}
                  onChange={setGasUpper}
                />
                <PercentileSelect
                  label="Lower"
                  value={gasLower}
                  presets={LOWER_PRESETS}
                  onChange={setGasLower}
                />
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[340px] w-full" />
              ) : (
                <>
                  <FanChart
                    history={gasHistory}
                    forecast={gasFan?.points ?? []}
                    unitLabel="MMBtu"
                    bandLabel={`${gasLower}th–${gasUpper}th percentile band`}
                    reference={piaReference}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    {bandCaption(gasUpper, gasLower)} The PIA line holds the
                    latest regulated value flat into the future because it is
                    reset annually by the NMDPRA.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* --------------------------- ASSUMPTIONS --------------------------- */}
      <div className="mt-8 space-y-4">
        <CollapsibleCard
          title="Assumptions — refine the forecast (defaults are data-driven)"
          icon={<SlidersHorizontal className="h-4 w-4 text-muted-foreground" />}
          open={assumptionsOpen}
          onToggle={() => setAssumptionsOpen((v) => !v)}
        >
          <div className="grid gap-6 sm:grid-cols-2">
            {(
              [
                {
                  heading: "Oil (Brent, $/bbl)",
                  growth: oilGrowth, setGrowth: setOilGrowth,
                  anchor: oilAnchor, setAnchor: setOilAnchor,
                  vol: oilVolMult, setVol: setOilVolMult,
                },
                {
                  heading: `Gas (${BENCHMARK_META[gasBenchmark].label}, $/MMBtu)`,
                  growth: gasGrowth, setGrowth: setGasGrowth,
                  anchor: gasAnchor, setAnchor: setGasAnchor,
                  vol: gasVolMult, setVol: setGasVolMult,
                },
              ] as const
            ).map((col) => (
              <div key={col.heading} className="space-y-3">
                <p className="text-sm font-medium">{col.heading}</p>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Long-term growth override (%/yr, blank = historical trend)
                  </Label>
                  <Input
                    type="number"
                    step={0.5}
                    value={col.growth}
                    onChange={(e) => col.setGrowth(e.target.value)}
                    placeholder="e.g. 2"
                    className="h-8 sm:max-w-[160px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Terminal price anchor at the horizon ($, blank = none)
                  </Label>
                  <Input
                    type="number"
                    step={1}
                    value={col.anchor}
                    onChange={(e) => col.setAnchor(e.target.value)}
                    placeholder="blend the central path toward this"
                    className="h-8 sm:max-w-[220px]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Volatility multiplier (1 = as history suggests)
                  </Label>
                  <Input
                    type="number"
                    step={0.1}
                    min={0}
                    value={col.vol}
                    onChange={(e) => col.setVol(e.target.value)}
                    className="h-8 sm:max-w-[120px]"
                  />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="How this forecast works"
          icon={<Info className="h-4 w-4 text-muted-foreground" />}
          open={methodOpen}
          onToggle={() => setMethodOpen((v) => !v)}
        >
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              The forecast looks at how prices have moved historically and
              projects that trend forward. The shaded band shows a range of
              plausible outcomes based on how volatile prices have been — it
              gets wider further out because the future is less certain.
            </p>
            <p>
              The upper band is an optimistic scenario: at the 85th percentile,
              prices stay below that level in about 85% of scenarios. The lower
              band is the conservative floor at its percentile. The central
              line is the middle of the range (the 50th percentile).
            </p>
            <p className="font-medium text-foreground">
              This is a statistical projection, not a guarantee, and it is not
              financial advice. Real prices are driven by events no trend model
              can anticipate.
            </p>
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
}
