"use client";

import Link from "next/link";
import Card, { CardHeader } from "@/components/ui/Card";
import type { SubjectMastery } from "@/lib/prep-insights";

function tone(mastery: number) {
  if (mastery >= 75) return "bg-emerald-500/25 text-emerald-700 dark:text-emerald-300";
  if (mastery >= 50) return "bg-amber-400/25 text-amber-700 dark:text-amber-300";
  if (mastery >= 25) return "bg-orange-500/25 text-orange-700 dark:text-orange-300";
  return "bg-red-500/20 text-red-700 dark:text-red-300";
}

export default function MasteryHeatmap({ subjects }: { subjects: SubjectMastery[] }) {
  return (
    <Card>
      <CardHeader
        title="Mastery by subject"
        subtitle="Completed questions weighted by your confidence. Weakest first."
      />
      {subjects.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Add questions to a subject to see mastery here.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((s) => (
            <li key={s.subjectId}>
              <Link
                href="/questions"
                className={`block rounded-lg p-3 transition-opacity hover:opacity-90 ${tone(s.mastery)}`}
                aria-label={`${s.name}: ${s.mastery}% mastery, ${s.done} of ${s.total} done`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{s.name}</span>
                  <span className="text-lg font-bold">{s.mastery}%</span>
                </div>
                <div className="mt-1 text-xs opacity-80">
                  {s.done}/{s.total} done
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[var(--muted)]">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-red-500/40" />
          &lt;25%
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-orange-500/40" />
          25–49%
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-400/40" />
          50–74%
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-500/40" />
          75%+
        </span>
      </div>
    </Card>
  );
}
