"use client";

import { useMemo, useState } from "react";
import type { SalesDataPoint, SalesView } from "@/lib/admin/types";

type SalesChartProps = {
  monthlyData: SalesDataPoint[];
  weeklyData: SalesDataPoint[];
};

function getNiceMax(value: number) {
  if (value <= 0) return 1000;

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function buildYLabels(maxValue: number) {
  const step = maxValue / 4;
  return [maxValue, step * 3, step * 2, step, 0].map((value) => Math.round(value));
}

const viewConfig = {
  monthly: {
    title: "Monthly Sales",
    subtitle: "Sales performance across the year",
    peakLabel: "Peak month",
  },
  weekly: {
    title: "Weekly Sales",
    subtitle: "Daily sales for the current week",
    peakLabel: "Peak day",
  },
} as const;

export function SalesChart({ monthlyData, weeklyData }: SalesChartProps) {
  const [view, setView] = useState<SalesView>("monthly");

  const data = view === "monthly" ? monthlyData : weeklyData;
  const config = viewConfig[view];

  const { maxValue, yLabels, peak, total } = useMemo(() => {
    const peakAmount = Math.max(...data.map((item) => item.amount));
    const max = getNiceMax(peakAmount);

    return {
      maxValue: max,
      yLabels: buildYLabels(max),
      peak: peakAmount,
      total: data.reduce((sum, item) => sum + item.amount, 0),
    };
  }, [data]);

  return (
    <div className="admin-panel rounded-2xl p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold text-[#800000]">
            {config.title}
          </h2>
          <p className="mt-1 text-sm text-muted">{config.subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-accent/10 bg-accent-light/50 p-1">
            {(["monthly", "weekly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setView(option)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                  view === option
                    ? "bg-gradient-to-r from-accent to-accent-dark text-white shadow-sm"
                    : "text-accent hover:bg-white/70"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="rounded-xl bg-accent-light px-3 py-2 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent/70">
              {config.peakLabel}
            </p>
            <p className="text-sm font-semibold text-accent">
              ₱{peak.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between rounded-xl border border-accent/8 bg-accent-light/40 px-4 py-3 text-sm">
        <span className="text-muted">
          {view === "monthly" ? "Total yearly sales" : "Total this week"}
        </span>
        <span className="font-semibold text-[#800000]">
          ₱{total.toLocaleString()}
        </span>
      </div>

      <div className="flex gap-4">
        <div className="flex h-56 flex-col justify-between pb-8 text-right text-xs text-muted">
          {yLabels.map((label) => (
            <span key={label}>{label.toLocaleString()}</span>
          ))}
        </div>

        <div className="relative flex flex-1 items-end gap-2 border-b border-accent/10 pb-2 pl-2">
          <div className="pointer-events-none absolute inset-0 grid grid-rows-4">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="border-t border-dashed border-accent/8" />
            ))}
          </div>

          {data.map((item) => {
            const height = `${(item.amount / maxValue) * 100}%`;
            const isPeak = item.amount === peak;

            return (
              <div
                key={item.label}
                className="relative z-10 flex flex-1 flex-col items-center gap-2"
              >
                <div className="flex h-48 w-full items-end justify-center">
                  <div
                    className={`admin-chart-bar w-full max-w-9 ${isPeak ? "ring-2 ring-accent/30 ring-offset-2" : ""}`}
                    style={{ height }}
                    title={`₱${item.amount.toLocaleString()}`}
                  />
                </div>
                <span
                  className={`text-xs ${isPeak ? "font-semibold text-accent" : "text-muted"}`}
                >
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
