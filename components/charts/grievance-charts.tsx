"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  GrievanceAnalytics,
  GrievanceSeverity,
} from "@/types";

/** Shared tooltip: card surface, text in text tokens (never series color). */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number | string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-card px-3 py-2 text-xs shadow-md">
      {label && <p className="mb-1 font-medium text-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="text-muted-foreground">
          <span
            className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
            style={{ background: p.color }}
            aria-hidden
          />
          {p.name}: <span className="font-medium text-foreground">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

const AXIS_TICK = { fill: "hsl(var(--muted-foreground))", fontSize: 11 };
const GRID_STROKE = "hsl(var(--border))";

/** Received vs resolved per month — two series, categorical slots 1 & 2. */
export function MonthlyTrendChart({
  data,
  height = 260,
}: {
  data: GrievanceAnalytics["monthly"];
  height?: number;
}) {
  const rows = data.map((m) => ({
    ...m,
    label: `${m.month.slice(5)}/${m.month.slice(2, 4)}`,
  }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID_STROKE} vertical={false} />
        <XAxis dataKey="label" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: GRID_STROKE }} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "hsl(var(--muted-foreground))" }}
        />
        <Bar
          dataKey="received"
          name="Received"
          fill="var(--chart-1)"
          radius={[4, 4, 0, 0]}
          maxBarSize={16}
        />
        <Bar
          dataKey="resolved"
          name="Resolved"
          fill="var(--chart-2)"
          radius={[4, 4, 0, 0]}
          maxBarSize={16}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Severity mix — an ordered scale (Low → High), so a one-hue ordinal ramp
 * with monotone lightness; direct value labels double as the table view.
 */
export function SeverityChart({
  data,
  height = 180,
}: {
  data: GrievanceAnalytics["severityCounts"];
  height?: number;
}) {
  const order: GrievanceSeverity[] = ["Low", "Medium", "High"];
  const ramp = ["var(--chart-ordinal-1)", "var(--chart-ordinal-2)", "var(--chart-ordinal-3)"];
  const rows = order.map((s, i) => ({ name: s, count: data[s], fill: ramp[i] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={56}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
        <Bar dataKey="count" name="Grievances" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.fill} />
          ))}
          <LabelList
            dataKey="count"
            position="right"
            style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Grievances by category — nominal magnitudes, single hue, labeled ends. */
export function CategoryChart({
  data,
  height = 320,
}: {
  data: GrievanceAnalytics["byCategory"];
  height?: number;
}) {
  const rows = data.map((c) => ({ name: c.category, total: c.total }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 36, bottom: 0, left: 8 }}>
        <CartesianGrid stroke={GRID_STROKE} horizontal={false} />
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ ...AXIS_TICK, fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={150}
        />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.4)" }} />
        <Bar
          dataKey="total"
          name="Grievances"
          fill="var(--chart-1)"
          radius={[0, 4, 4, 0]}
          maxBarSize={18}
        >
          <LabelList
            dataKey="total"
            position="right"
            style={{ fill: "hsl(var(--foreground))", fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
