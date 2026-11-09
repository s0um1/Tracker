"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Flame, Settings, Target } from "lucide-react";
import { apiGet } from "@/lib/api";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { ProfilePageSkeleton, ErrorState } from "@/components/ui/StateViews";
import { Heatmap, HeatLegend } from "@/components/ui/Heatmap";
import { formatDate, istDateKey } from "@/lib/utils";
import type { UserProfile } from "@/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function hours(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function lastActive(days: number | null | undefined) {
  if (days === null || days === undefined) return "No activity yet";
  if (days === 0) return "Active today";
  if (days === 1) return "Active yesterday";
  return `Last active ${days} days ago`;
}

function masteryTone(m: number) {
  if (m >= 75) return "text-emerald-600";
  if (m >= 50) return "text-amber-600";
  if (m >= 25) return "text-orange-600";
  return "text-red-600";
}

function Stat({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl bg-[var(--surface-muted)] p-3.5">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-xl font-bold leading-tight">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

function ScoreSpark({ points }: { points: { date: string; score: number }[] }) {
  const W = 220;
  const H = 56;
  if (points.length === 0) return null;
  const x = (i: number) => (points.length === 1 ? W / 2 : 6 + (i * (W - 12)) / (points.length - 1));
  const y = (v: number) => H - 6 - (Math.min(100, Math.max(0, v)) / 100) * (H - 12);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-14 w-full max-w-[220px]" role="img" aria-label="Recent mock scores">
      {points.length > 1 && (
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-brand"
          points={points.map((p, i) => `${x(i)},${y(p.score)}`).join(" ")}
        />
      )}
      {points.map((p, i) => (
        <circle key={p.date} cx={x(i)} cy={y(p.score)} r={3.5} className="fill-brand" />
      ))}
    </svg>
  );
}

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProfile(await apiGet<UserProfile>(`/api/users/${userId}/profile`));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <ProfilePageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!profile) return null;

  const { stats, subjects = [], mock, interview, target } = profile;
  const taskPercent = profile.tasksTotal ? Math.round((profile.tasksCompleted / profile.tasksTotal) * 100) : 0;
  const roleLabel = profile.role ? profile.role.replace(/[-_]/g, " ") : null;

  return (
    <div className="space-y-6">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-brand/15 to-transparent" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand text-xl font-bold text-white shadow-sm sm:h-20 sm:w-20 sm:text-2xl"
              aria-hidden
            >
              {initials(profile.name) || "?"}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold text-[var(--foreground)]">{profile.name}</h1>
                {profile.isSelf && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-semibold text-brand">You</span>
                )}
              </div>
              <p className="text-sm text-[var(--muted)]">@{profile.username}</p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-medium">
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 capitalize">
                  {profile.preparationLevel}
                </span>
                {roleLabel && (
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 capitalize">{roleLabel}</span>
                )}
                {profile.studyStreak > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-600">
                    <Flame className="h-3 w-3" aria-hidden /> {profile.studyStreak}-day streak
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-[var(--muted)]">
                {[
                  profile.joinedAt ? `Member since ${formatDate(profile.joinedAt)}` : null,
                  stats ? lastActive(stats.daysSinceActive) : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
            {profile.isSelf && (
              <Link href="/settings">
                <Button variant="outline" size="sm">
                  <Settings className="h-3.5 w-3.5" aria-hidden /> Settings
                </Button>
              </Link>
            )}
          </div>
        </div>

        {(interview || (target && (target.company || target.role))) && (
          <div className="relative mt-5 flex flex-wrap gap-x-6 gap-y-2 border-t border-[var(--border)] pt-4 text-sm">
            {target && (target.company || target.role) && (
              <span className="inline-flex items-center gap-2">
                <Target className="h-4 w-4 text-brand" aria-hidden />
                {[target.role, target.company].filter(Boolean).join(" @ ")}
              </span>
            )}
            {interview && (
              <span className="inline-flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-brand" aria-hidden />
                Interview {formatDate(interview.date)} ·{" "}
                {interview.daysLeft === 0 ? "today or passed" : `${interview.daysLeft} day${interview.daysLeft === 1 ? "" : "s"} left`}
              </span>
            )}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Questions done"
          value={stats ? `${stats.questionsDone}/${stats.questionsTotal}` : "–"}
          hint={stats ? `${stats.doneLast7Days} in the last 7 days` : undefined}
        />
        <Stat label="Points" value={stats?.points ?? 0} hint="From group questions" />
        <Stat
          label="Study time"
          value={stats ? hours(stats.studyMinutesWeek) : "–"}
          hint={stats ? `${hours(stats.studyMinutesTotal)} total` : undefined}
        />
        <Stat
          label="Tasks done"
          value={`${profile.tasksCompleted}/${profile.tasksTotal}`}
          hint={profile.tasksTotal ? `${taskPercent}% complete` : "No tasks yet"}
        />
        <Stat label="Streak" value={`${profile.studyStreak} day${profile.studyStreak === 1 ? "" : "s"}`} />
        <Stat label="Daily goal" value={hours(profile.dailyStudyMinutes)} hint="Study time target" />
        <Stat
          label="Mock interviews"
          value={mock?.count ?? 0}
          hint={mock?.avgScore != null ? `Average ${mock.avgScore}/100` : "None yet"}
        />
        <Stat label="Level" value={<span className="capitalize">{profile.preparationLevel}</span>} />
      </div>

      {stats && (
        <Card>
          <CardHeader title="Activity" subtitle="Questions completed each day" action={<HeatLegend />} />
          <Heatmap
            heat={stats.heat ?? {}}
            todayKey={istDateKey(new Date())}
            label={`${profile.name}'s questions completed over time`}
          />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Subject mastery" subtitle="Completed questions weighted by confidence" />
          {subjects.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No subjects with questions yet.</p>
          ) : (
            <ul className="space-y-3">
              {subjects.map((s) => (
                <li key={s.name}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{s.name}</span>
                    <span className={`shrink-0 text-xs font-semibold ${masteryTone(s.mastery)}`}>
                      {s.mastery}% · {s.done}/{s.total}
                    </span>
                  </div>
                  <ProgressBar value={s.mastery} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Strengths & focus areas" />
            <div className="space-y-3 text-sm">
              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">Strong in</p>
                {profile.strongSubjects.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.strongSubjects.map((s) => (
                      <span key={s} className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">Nothing marked strong yet.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-[var(--muted)]">Needs work</p>
                {profile.weakSubjects.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {profile.weakSubjects.map((s) => (
                      <span key={s} className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-300">
                        {s}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[var(--muted)]">No weak areas flagged.</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Mock interviews" />
            {!mock || mock.count === 0 ? (
              <p className="text-sm text-[var(--muted)]">No mock interview results yet.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div>
                    <p className="text-3xl font-bold">{mock.avgScore}</p>
                    <p className="text-xs text-[var(--muted)]">avg score · {mock.count} review{mock.count === 1 ? "" : "s"}</p>
                  </div>
                  <ScoreSpark points={mock.last} />
                </div>
                {Object.values(mock.rubric).some((v) => v != null) && (
                  <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    {Object.entries(mock.rubric).map(([k, v]) => (
                      <li key={k}>
                        <div className="mb-0.5 flex justify-between capitalize">
                          <span>{k}</span>
                          <span className="font-semibold">{v != null ? `${v}/5` : "–"}</span>
                        </div>
                        <ProgressBar value={v != null ? (v / 5) * 100 : 0} size="sm" />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>

      {profile.sharedGroups.length > 0 && (
        <Card>
          <CardHeader title="Shared groups" />
          <div className="grid gap-2 sm:grid-cols-2">
            {profile.sharedGroups.map((g) => (
              <Link
                key={g._id}
                href={`/groups/${g._id}`}
                className="block rounded-lg border border-[var(--border)] px-4 py-2.5 text-sm font-medium hover:bg-[var(--surface-muted)]"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
