"use client";

import { format, parseISO } from "date-fns";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PricePoint } from "@/types";
import type { FanPoint } from "@/lib/forecast-engine";

/** A stepped policy/reference series (e.g. the Nigeria PIA gas price). */
export interface ReferenceSeries {
  name: string;
  /** Sorted ascending by date; floor set only for band references. */
  points: Array<{ date: string; value: number; floor?: number }>;
}

interface Row {
  date: string;
  history?: number;
  central?: number;
  upper?: number;
  lower?: number;
  band?: [number, number];
  extra?: number;
  ref?: number;
  refBand?: [number, number];
}

/** Value of a stepped reference at a date: the latest step at or before it. */
function steppedValueAt(
  reference: ReferenceSeries,
  date: string
): { value: number; floor?: number } | undefined {
  let hit: { value: number; floor?: number } | undefined;
  for (const p of reference.points) {
    if (p.date <= date) hit = { value: p.value, floor: p.floor };
    else break;
  }
  return hit;
}

/**
 * Fan chart: muted history, solid central forecast, shaded percentile band,
 * a "today" divider, and optional overlay lines (e.g. Nigerian crude, PIA).
 */
export function FanChart({
  history,
  forecast,
  unitLabel,
  bandLabel,
  extraLine,
  reference,
  height = 340,
}: {
  history: PricePoint[];
  forecast: FanPoint[];
  /** Axis/tooltip unit, e.g. "bbl" or "MMBtu". */
  unitLabel: string;
  /** e.g. "25th–85th percentile" for the legend. */
  bandLabel: string;
  extraLine?: { name: string; points: Array<{ date: string; value: number }> };
  reference?: ReferenceSeries;
  height?: number;
}) {
  if (history.length === 0 || forecast.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        Not enough price history to build this forecast.
      </div>
    );
  }

  const rows = new Map<string, Row>();
  const rowFor = (date: string): Row => {
    let row = rows.get(date);
    if (!row) {
      row = { date };
      rows.set(date, row);
    }
    return row;
  };

  for (const p of history) rowFor(p.date).history = p.price;
  for (const p of forecast) {
    const row = rowFor(p.date);
    row.central = p.central;
    row.upper = p.upper;
    row.lower = p.lower;
    row.band = [p.lower, p.upper];
  }
  for (const p of extraLine?.points ?? []) rowFor(p.date).extra = p.value;

  const data = Array.from(rows.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (reference) {
    for (const row of data) {
      const step = steppedValueAt(reference, row.date);
      if (!step) continue;
      row.ref = step.value;
      if (step.floor !== undefined) row.refBand = [step.floor, step.value];
    }
  }

  const todayDate = forecast[0].date;
  const spanYears =
    (Date.parse(data[data.length - 1].date) - Date.parse(data[0].date)) /
    (365.25 * 86_400_000);

  const all = data.flatMap((r) =>
    [r.history, r.upper, r.lower, r.central, r.extra, r.ref, r.refBand?.[0]].filter(
      (n): n is number => typeof n === "number"
    )
  );
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.08 || 1;

  const NAME_LABELS: Record<string, string> = {
    history: "History",
    central: "Central forecast",
    band: "Band",
    extra: extraLine?.name ?? "Overlay",
    ref: reference?.name ?? "Reference",
    refBand: `${reference?.name ?? "Reference"} band`,
  };

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) =>
              format(parseISO(d), spanYears > 4 ? "yyyy" : "MMM yy")
            }
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            minTickGap={40}
            stroke="hsl(var(--border))"
          />
          <YAxis
            domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v: number) => `$${v}`}
            width={56}
            stroke="hsl(var(--border))"
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              color: "hsl(var(--popover-foreground))",
              fontSize: 12,
            }}
            labelFormatter={(d) => format(parseISO(String(d)), "MMM yyyy")}
            formatter={(value, name) => {
              if (value == null) return [undefined, undefined];
              if (name === "band" || name === "refBand") {
                const [lo, hi] = value as [number, number];
                return [
                  `$${lo.toFixed(2)} – $${hi.toFixed(2)} /${unitLabel}`,
                  NAME_LABELS[String(name)],
                ];
              }
              return [
                `$${Number(value).toFixed(2)} /${unitLabel}`,
                NAME_LABELS[String(name)] ?? String(name),
              ];
            }}
          />

          {/* Percentile fan between the chosen lower and upper bands. */}
          <Area
            dataKey="band"
            name="band"
            stroke="none"
            fill="hsl(var(--accent))"
            fillOpacity={0.15}
            isAnimationActive={false}
            connectNulls
          />
          {/* Light band for banded policy prices (floor → ceiling). */}
          {reference && (
            <Area
              dataKey="refBand"
              name="refBand"
              stroke="none"
              fill="hsl(var(--warning))"
              fillOpacity={0.08}
              isAnimationActive={false}
              connectNulls
            />
          )}

          <Line
            dataKey="history"
            name="history"
            stroke="hsl(var(--muted-foreground))"
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          <Line
            dataKey="central"
            name="central"
            stroke="hsl(var(--accent))"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            connectNulls
          />
          {extraLine && (
            <Line
              dataKey="extra"
              name="extra"
              stroke="hsl(var(--success))"
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          {/* Dashed + stepped so the policy price never reads as a market line. */}
          {reference && (
            <Line
              dataKey="ref"
              name="ref"
              type="stepAfter"
              stroke="hsl(var(--warning))"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}

          <ReferenceLine
            x={todayDate}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="2 3"
            label={{
              value: "Today",
              position: "insideTopLeft",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 11,
            }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-muted-foreground" />
          History
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-accent" />
          Central forecast
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-5 rounded-sm bg-accent/20" />
          {bandLabel}
        </span>
        {extraLine && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-success" />
            {extraLine.name}
          </span>
        )}
        {reference && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 border-t-2 border-dashed border-warning" />
            {reference.name}
          </span>
        )}
      </div>
    </div>
  );
}
