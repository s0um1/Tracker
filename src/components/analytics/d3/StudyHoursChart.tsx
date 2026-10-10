"use client";

import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { formatTooltip, getChartTheme, hideTooltip, useChartSize } from "./utils";

type StudyHoursDatum = { label: string; value: number; /** IST yyyy-mm-dd */ date?: string };

interface StudyHoursChartProps {
  data: StudyHoursDatum[];
  color?: string;
  /** Tooltip suffix, e.g. "done" or "pts" */
  valueSuffix?: string;
}

const MARGIN_BASE = { top: 12, right: 8, bottom: 28, left: 36 };

/** Min horizontal space per x tick label (px). */
const TICK_MIN_PX = 46;

function domainKey(d: StudyHoursDatum, i: number): string {
  return d.date ?? `${d.label}#${i}`;
}

function pickTickIndices(length: number, maxTicks: number): number[] {
  const cap = Math.max(2, Math.min(length, maxTicks));
  if (length <= cap) return Array.from({ length }, (_, i) => i);
  const out: number[] = [];
  for (let t = 0; t < cap; t++) {
    out.push(Math.round((t * (length - 1)) / (cap - 1)));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Compact axis text; full `label` stays in tooltip. */
function axisTickLabel(
  datum: StudyHoursDatum,
  index: number,
  total: number
): string {
  const first = index === 0;
  const last = index === total - 1;
  if (datum.date) {
    const dt = new Date(`${datum.date}T12:00:00+05:30`);
    const day = dt.getDate();
    if (first || last || day === 1) {
      return dt.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      });
    }
    return String(day);
  }
  if (first || last) return datum.label;
  const parts = datum.label.split(" ");
  return parts[0] ?? datum.label;
}

function integerYTicks(maxVal: number): number[] {
  const top = Math.max(1, Math.ceil(maxVal));
  if (top <= 5) return d3.range(0, top + 1);
  const step = Math.ceil(top / 5);
  const ticks: number[] = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== top) ticks.push(top);
  return ticks;
}

export default function StudyHoursChart({
  data,
  color = "#25A6EE",
  valueSuffix = "h studied",
}: StudyHoursChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const { containerRef, size } = useChartSize();

  const total = data.reduce((s, d) => s + d.value, 0);

  useEffect(() => {
    if (!svgRef.current || !tooltipRef.current || size.width === 0 || data.length === 0) return;

    const theme = getChartTheme();
    const keys = data.map(domainKey);
    const plotWidthGuess = size.width - MARGIN_BASE.left - MARGIN_BASE.right;
    const maxTicks = Math.max(3, Math.floor(plotWidthGuess / TICK_MIN_PX));
    const tickIndices = pickTickIndices(data.length, maxTicks);
    const rotate =
      tickIndices.length > 1 &&
      plotWidthGuess / tickIndices.length < TICK_MIN_PX - 4;
    const margin = {
      ...MARGIN_BASE,
      bottom: rotate ? 48 : 32,
    };

    const width = size.width - margin.left - margin.right;
    const height = size.height - margin.top - margin.bottom;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const g = svg
      .attr("width", size.width)
      .attr("height", size.height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand()
      .domain(keys)
      .range([0, width])
      .padding(0.25);

    const maxVal = d3.max(data, (d) => d.value) ?? 0;
    const yTop = Math.max(1, Math.ceil(maxVal));
    const y = d3.scaleLinear().domain([0, yTop]).range([height, 0]);

    const tickKeys = tickIndices.map((i) => keys[i]);

    const xAxis = g
      .append("g")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(x)
          .tickSize(0)
          .tickValues(tickKeys)
          .tickFormat((key) => {
            const i = keys.indexOf(String(key));
            const datum = data[i];
            return datum ? axisTickLabel(datum, i, data.length) : String(key);
          })
      )
      .call((axis) => axis.select(".domain").remove());

    xAxis.selectAll("text").each(function () {
      const el = d3.select(this);
      el.attr("fill", theme.muted).attr("font-size", 10);
      if (rotate) {
        el.attr("transform", "rotate(-42)")
          .attr("text-anchor", "end")
          .attr("dx", "-0.35em")
          .attr("dy", "0.15em");
      } else {
        el.attr("text-anchor", "middle").attr("dy", "0.75em");
      }
    });

    g.append("g")
      .call(
        d3
          .axisLeft(y)
          .tickValues(integerYTicks(maxVal))
          .tickFormat((v) => String(v))
          .tickSize(-width)
      )
      .call((axis) => axis.select(".domain").remove())
      .call((axis) =>
        axis.selectAll("text").attr("fill", theme.muted).attr("font-size", 10)
      )
      .call((axis) =>
        axis.selectAll(".tick line").attr("stroke", theme.grid).attr("stroke-dasharray", "3,3")
      );

    g.selectAll("rect")
      .data(data)
      .join("rect")
      .attr("x", (_, i) => x(keys[i]) ?? 0)
      .attr("width", x.bandwidth())
      .attr("rx", 3)
      .attr("fill", color)
      .attr("opacity", (d) => (d.value > 0 ? 0.92 : 0.2))
      .attr("y", (d) => y(d.value))
      .attr("height", (d) => Math.max(0, height - y(d.value)))
      .on("mouseenter", function (event, d) {
        if (d.value <= 0) return;
        d3.select(this).attr("opacity", 1);
        formatTooltip(
          tooltipRef.current!,
          `<strong>${d.label}</strong><br/>${d.value} ${valueSuffix}`,
          event.offsetX,
          event.offsetY - 28
        );
      })
      .on("mousemove", (event, d) => {
        if (d.value <= 0) return;
        formatTooltip(
          tooltipRef.current!,
          `<strong>${d.label}</strong><br/>${d.value} ${valueSuffix}`,
          event.offsetX,
          event.offsetY - 28
        );
      })
      .on("mouseleave", function (_, d) {
        d3.select(this).attr("opacity", d.value > 0 ? 0.92 : 0.2);
        hideTooltip(tooltipRef.current!);
      });
  }, [color, data, size, valueSuffix]);

  if (data.length === 0) {
    return (
      <div className="flex h-full min-h-[8rem] items-center justify-center text-sm text-[var(--muted)]">
        No data for this period.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative h-full w-full min-h-[8rem]">
      {total === 0 ? (
        <p className="absolute left-0 top-0 z-[1] text-xs text-[var(--muted)]">
          No completions in the last {data.length} days — bars show the timeline.
        </p>
      ) : null}
      <svg ref={svgRef} className="h-full w-full" />
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute z-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs shadow-md"
        style={{ opacity: 0, transform: "translate(-50%, -100%)" }}
      />
    </div>
  );
}
