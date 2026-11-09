"use client";

import Link from "next/link";
import Card, { CardHeader } from "@/components/ui/Card";
import type { AnalyticsData } from "@/types";

function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

function StatusList({ rows }: { rows: { label: string; count: number }[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No questions yet.</p>;
  }
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-[var(--foreground)]">{r.label}</span>
            <span className="text-[var(--muted)]">{r.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${Math.round((r.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

interface AnalyticsChartsProps {
  data: AnalyticsData;
  currentUserId?: string;
}

export default function AnalyticsCharts({ data, currentUserId }: AnalyticsChartsProps) {
  const { personal, group } = data;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Group</h2>
          <p className="text-sm text-[var(--muted)]">Shared questions and team progress.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Group done"
            value={`${group.summary.yourDone}/${group.summary.totalQuestions}`}
            hint="Your shared questions"
          />
          <StatCard label="Your points" value={group.summary.yourPoints} />
          <StatCard label="Members" value={group.summary.memberCount} />
        </div>
        <Card>
          <CardHeader title="Group questions" subtitle="Your progress on shared questions" />
          <StatusList rows={group.byStatus} />
        </Card>
        {group.leaderboard.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-2">
            {group.leaderboard.length > 0 && (
              <Card>
                <CardHeader title="Leaderboard" subtitle="Group question points" />
                <ul className="space-y-2">
                  {group.leaderboard.map((m, i) => (
                    <li
                      key={m.userId}
                      className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                    >
                      <span className="text-[var(--muted)]">{i + 1}.</span>
                      <Link
                        href={`/users/${m.userId}`}
                        className="min-w-0 flex-1 px-2 font-medium text-brand hover:underline"
                      >
                        {m.name}
                        {currentUserId === m.userId ? " (you)" : ""}
                      </Link>
                      <span className="font-semibold text-brand">{m.points} pts</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Personal</h2>
          <p className="text-sm text-[var(--muted)]">Your solo practice.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Personal done"
            value={personal.summary.done}
            hint={`${personal.summary.totalQuestions} total`}
          />
          <StatCard label="Study streak" value={`${personal.summary.studyStreak} days`} />
          <StatCard
            label="Tasks done"
            value={`${personal.summary.tasksCompleted}/${personal.summary.tasksTotal}`}
          />
        </div>
        <Card>
          <CardHeader title="Personal questions" subtitle="By status" />
          <StatusList rows={personal.byStatus} />
        </Card>
      </section>
    </div>
  );
}
