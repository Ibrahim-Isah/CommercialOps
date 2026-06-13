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
import type { ForecastPoint } from "@/types";

export function ForecastChart({
  points,
  height = 320,
}: {
  points: ForecastPoint[];
  height?: number;
}) {
  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-muted-foreground"
        style={{ height }}
      >
        No data available to forecast.
      </div>
    );
  }

  // Build a [lower, upper] band field for the confidence area.
  const data = points.map((p) => ({
    ...p,
    band:
      p.lower !== undefined && p.upper !== undefined
        ? [p.lower, p.upper]
        : undefined,
  }));

  const all = points.flatMap((p) =>
    [p.actual, p.forecast, p.upper, p.lower].filter(
      (n): n is number => typeof n === "number"
    )
  );
  const min = Math.min(...all);
  const max = Math.max(...all);
  const pad = (max - min) * 0.08 || 1;

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
          tickFormatter={(d: string) => format(parseISO(d), "d MMM")}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          minTickGap={32}
          stroke="hsl(var(--border))"
        />
        <YAxis
          domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          tickFormatter={(v: number) => `$${v}`}
          width={52}
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
          labelFormatter={(d) => format(parseISO(String(d)), "d MMM yyyy")}
          formatter={(value, name) => {
            if (name === "band" || value == null) return [undefined, undefined];
            const label =
              name === "actual" ? "Actual" : name === "forecast" ? "Forecast" : name;
            return [`$${Number(value).toFixed(2)}`, label as string];
          }}
        />
        <Area
          dataKey="band"
          stroke="none"
          fill="hsl(var(--accent))"
          fillOpacity={0.15}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          dataKey="actual"
          stroke="hsl(var(--foreground))"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
        <Line
          dataKey="forecast"
          stroke="hsl(var(--accent))"
          strokeWidth={2}
          strokeDasharray="6 4"
          dot={false}
          isAnimationActive={false}
          connectNulls
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
