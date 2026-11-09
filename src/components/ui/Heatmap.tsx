"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const CELL = 11;
const GAP = 3;
const DAY_LABEL_W = 28;
const HEAT_LEVELS = [
  "bg-[var(--surface-muted)] ring-1 ring-inset ring-[var(--border)]",
  "bg-brand/25",
  "bg-brand/50",
  "bg-brand/75",
  "bg-brand",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Every week of the calendar year (Sun to Sat columns). Days outside the year are null. */
function yearGrid(year: number): (string | null)[][] {
  const day = 86_400_000;
  const jan1 = Date.UTC(year, 0, 1);
  const dec31 = Date.UTC(year, 11, 31);
  const start = jan1 - new Date(jan1).getUTCDay() * day;
  const weeks = Math.ceil((dec31 - start + day) / (7 * day));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const t = start + (w * 7 + d) * day;
      return t < jan1 || t > dec31 ? null : new Date(t).toISOString().slice(0, 10);
    })
  );
}

/** GitHub-style contribution graph for the current calendar year, January to December. */
export function Heatmap({ heat, todayKey, label }: { heat: Record<string, number>; todayKey: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const year = Number(todayKey.slice(0, 4));
  const grid = yearGrid(year);
  const weeks = grid.length;
  const [cell, setCell] = useState(CELL);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Stretch the squares so the year fills the full width (never smaller than 11px; scrolls if narrower).
    const fit = () => setCell(Math.max(CELL, Math.floor((el.clientWidth - DAY_LABEL_W + GAP) / weeks) - GAP));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks]);

  const max = Math.max(1, ...Object.values(heat));
  const level = (n: number) => (n <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4))));
  const total = grid.flat().reduce((n, k) => n + (k ? (heat[k] ?? 0) : 0), 0);

  // Month label above the week that contains the 1st of that month.
  const monthLabels = grid.map((week) => {
    const first = week.find((k) => k?.endsWith("-01"));
    return first ? MONTHS[Number(first.slice(5, 7)) - 1] : "";
  });

  return (
    <div ref={ref} className="w-full overflow-x-auto">
      <p className="mb-2 text-xs text-[var(--muted)]">
        <span className="font-semibold text-[var(--foreground)]">{total}</span> question{total === 1 ? "" : "s"} in {year}
      </p>
      <div role="img" aria-label={label} className="flex" style={{ gap: GAP }}>
        <div className="flex shrink-0 flex-col text-[10px] leading-none text-[var(--muted)]" style={{ width: DAY_LABEL_W - GAP, gap: GAP, paddingTop: cell + GAP }}>
          {DAYS.map((d, i) => (
            <span key={i} className="flex items-center" style={{ height: cell }}>
              {d}
            </span>
          ))}
        </div>
        {grid.map((week, w) => (
          <div key={w} className="flex flex-col" style={{ gap: GAP, width: cell }}>
            <span className="relative text-[10px] leading-none text-[var(--muted)]" style={{ height: cell }}>
              <span className="absolute bottom-0 left-0 whitespace-nowrap">{monthLabels[w]}</span>
            </span>
            {week.map((key, d) => {
              const n = key ? (heat[key] ?? 0) : 0;
              return (
                <span
                  key={d}
                  className={clsx("rounded-[2px]", key ? HEAT_LEVELS[level(n)] : "invisible")}
                  style={{ width: cell, height: cell }}
                  title={key ? `${n} question${n === 1 ? "" : "s"} on ${key}` : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-1 text-[10px] text-[var(--muted)]">
      Less
      {HEAT_LEVELS.map((c, i) => (
        <span key={i} className={clsx("rounded-[2px]", c)} style={{ width: CELL, height: CELL }} />
      ))}
      More
    </div>
  );
}

/** The last 7 days ending today, one square per day. Matches the "this week" count and the weekly bar chart. */
export function WeekHeatmap({ heat, todayKey, label }: { heat: Record<string, number>; todayKey: string; label: string }) {
  const today = Date.parse(`${todayKey}T12:00:00Z`);
  const days = Array.from({ length: 7 }, (_, i) => new Date(today - (6 - i) * 86_400_000));
  const keys = days.map((d) => d.toISOString().slice(0, 10));
  const max = Math.max(1, ...keys.map((k) => heat[k] ?? 0));
  const level = (n: number) => (n <= 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4))));
  return (
    <div role="img" aria-label={label} className="grid w-full grid-cols-7 gap-1.5">
      {keys.map((key, i) => {
        const n = heat[key] ?? 0;
        const isToday = i === 6;
        return (
          <div key={key} className="flex flex-col items-center gap-1">
            <span
              className={clsx("aspect-square w-full rounded-md", HEAT_LEVELS[level(n)], isToday && "ring-2 !ring-brand/40")}
              title={`${n} question${n === 1 ? "" : "s"} on ${key}`}
            />
            <span className={clsx("text-[10px]", isToday ? "font-semibold text-brand" : "text-[var(--muted)]")}>
              {DAYS[days[i].getUTCDay()]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
