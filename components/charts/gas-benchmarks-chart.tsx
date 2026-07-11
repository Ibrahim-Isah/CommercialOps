"use client";

import { format, parseISO } from "date-fns";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GasBenchmarkKey, PricePoint } from "@/types";
import type { ReferenceSeries } from "@/components/charts/fan-chart";

export const BENCHMARK_META: Record<
  GasBenchmarkKey,
  { label: string; color: string }
> = {
  henry_hub: { label: "Henry Hub (US)", color: "hsl(var(--accent))" },
  ttf: { label: "TTF (Europe)", color: "hsl(var(--success))" },
  jkm: { label: "JKM (Asia LNG)", color: "hsl(var(--foreground))" },
};

/** Historical benchmark comparison with an optional stepped policy overlay. */
export function GasBenchmarksChart({
  series,
  visible,
  reference,
  height = 300,
}: {
  series: Record<GasBenchmarkKey, PricePoint[]>;
  visible: Record<GasBenchmarkKey, boolean>;
  reference?: ReferenceSeries;
  height?: number;
}) {
  const rows = new Map<
    string,
    { date: string } & Partial<Record<GasBenchmarkKey, number>> & {
        ref?: number;
        refBand?: [number, number];
      }
  >();
  const rowFor = (date: string) => {
    let row = rows.get(date);
    if (!row) {
      row = { date };
      rows.set(date, row);
    }
    return row;
  };

  for (const key of Object.keys(series) as GasBenchmarkKey[]) {
    if (!visible[key]) continue;
    for (const p of series[key]) rowFor(p.date)[key] = p.price;
  }

  const data = Array.from(rows.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No benchmark series to show — toggle one on or check the data source.
      </div>
    );
  }

  if (reference) {
    for (const row of data) {
      let hit: { value: number; floor?: number } | undefined;
      for (const p of reference.points) {
        if (p.date <= row.date) hit = { value: p.value, floor: p.floor };
        else break;
      }
      if (hit) {
        row.ref = hit.value;
        if (hit.floor !== undefined) row.refBand = [hit.floor, hit.value];
      }
    }
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="date"
          tickFormatter={(d: string) => format(parseISO(d), "MMM yy")}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          minTickGap={40}
          stroke="hsl(var(--border))"
        />
        <YAxis
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v: number) => `$${v}`}
          width={48}
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
            if (name === "refBand") {
              const [lo, hi] = value as [number, number];
              return [
                `$${lo.toFixed(2)} – $${hi.toFixed(2)} /MMBtu`,
                `${reference?.name ?? "Reference"} band`,
              ];
            }
            const label =
              name === "ref"
                ? reference?.name ?? "Reference"
                : BENCHMARK_META[name as GasBenchmarkKey]?.label ?? String(name);
            return [`$${Number(value).toFixed(2)} /MMBtu`, label];
          }}
        />

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
        {(Object.keys(BENCHMARK_META) as GasBenchmarkKey[]).map(
          (key) =>
            visible[key] && (
              <Line
                key={key}
                dataKey={key}
                name={key}
                stroke={BENCHMARK_META[key].color}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
                connectNulls
              />
            )
        )}
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
      </ComposedChart>
    </ResponsiveContainer>
  );
}
