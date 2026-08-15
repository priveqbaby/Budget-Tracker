"use client";

import {
  Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { formatCents, monthShort } from "@/lib/money";

export interface HistoryPointDto {
  month: string;
  spent: number;
  cap: number;
  partial: boolean;
}

export function HistoryChart({ points, selected }: { points: HistoryPointDto[]; selected: string }) {
  const data = points.map((p) => ({
    ...p,
    label: monthShort(p.month) + (p.partial ? " ·" : ""),
    dollars: p.spent / 100,
  }));

  return (
    <div className="h-[190px] w-full" role="img" aria-label="Variable spend by month">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="32%">
          <CartesianGrid vertical={false} stroke="var(--color-hairline)" strokeWidth={1} />
          <XAxis
            dataKey="label"
            axisLine={{ stroke: "var(--color-hairline-deep)" }}
            tickLine={false}
            tick={{ fill: "var(--color-ink-muted)", fontSize: 12, fontFamily: "var(--font-sans)" }}
          />
          <YAxis
            width={44}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `$${(v / 1000).toFixed(1)}k`}
            tick={{ fill: "var(--color-ink-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--color-sunken)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof data)[number];
              return (
                <div className="card px-3 py-2 text-[12.5px] shadow-pop">
                  <div className="font-semibold text-ink">
                    {monthShort(p.month)} {p.month.slice(0, 4)}
                    {p.partial && <span className="text-ink-muted"> · to date</span>}
                  </div>
                  <div className="money mt-0.5 text-ink-secondary">
                    {formatCents(p.spent)} <span className="text-ink-muted">of {formatCents(p.cap)}</span>
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="dollars" radius={[4, 4, 0, 0]} maxBarSize={56}>
            {data.map((p) => (
              <Cell
                key={p.month}
                fill={p.month === selected ? "var(--color-accent)" : "var(--color-hairline-strong)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
