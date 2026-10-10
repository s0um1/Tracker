"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import Card, { CardHeader } from "@/components/ui/Card";
import GroupLeaderboardChart from "@/components/groups/GroupLeaderboardChart";

const ChartSkeleton = () => (
  <div className="h-48 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
);

const SubjectCompletionChart = dynamic(
  () => import("@/components/analytics/d3/SubjectCompletionChart"),
  { ssr: false, loading: ChartSkeleton }
);
const MockScoresChart = dynamic(
  () => import("@/components/analytics/d3/MockScoresChart"),
  { ssr: false, loading: ChartSkeleton }
);
const StudyHoursChart = dynamic(
  () => import("@/components/analytics/d3/StudyHoursChart"),
  { ssr: false, loading: ChartSkeleton }
);
import { TOPIC_STATUS_META } from "@/lib/utils";
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

function StatusList({
  rows,
}: {
  rows: { label: string; count: number }[];
}) {
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
  const subjectChart = (data.subjectCompletion ?? []).map((d) => ({
    label: d.name,
    value: d.percent,
  }));

  const mockChart = (data.mockInterviewScores ?? []).map((d) => ({
    label: d.date,
    value: d.score,
    subject: d.subject,
  }));

  const personal = data.personal;
  const group = data.group;

  const topicRows = (data.topicStatusBreakdown ?? []).map((t) => ({
    label: TOPIC_STATUS_META[t.status]?.label ?? t.status,
    count: t.count,
  }));

  const leaderboardMax = group.leaderboard[0]?.points ?? 0;

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Personal</h2>
          <p className="text-sm text-[var(--muted)]">Your solo practice and study habits.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Personal questions"
            value={personal.summary.done}
            hint={`${personal.summary.totalQuestions} total · ${personal.summary.inProgress} in progress`}
          />
          <StatCard label="Study streak" value={`${personal.summary.studyStreak} days`} />
          <StatCard
            label="Focus this week"
            value={`${Math.round(personal.summary.studyMinutesWeek / 60)}h`}
            hint={`${personal.summary.studyMinutesWeek} min logged`}
          />
          <StatCard
            label="Tasks done"
            value={`${personal.summary.tasksCompleted}/${personal.summary.tasksTotal}`}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Personal by status" />
            <StatusList rows={personal.byStatus} />
          </Card>
          <Card>
            <CardHeader title="Done per day (14d)" subtitle="Personal questions" />
            <div className="h-52">
              <StudyHoursChart
                data={personal.activity.map((d) => ({
                  label: d.label,
                  value: d.count,
                  date: d.date,
                }))}
                color="#8b5cf6"
                valueSuffix="done"
              />
            </div>
          </Card>
          {personal.byTrack.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader title="Personal tracks" subtitle="% done per track" />
              <div className="h-56">
                <SubjectCompletionChart
                  data={personal.byTrack.map((t) => ({ label: t.name, value: t.percent }))}
                  color="#8b5cf6"
                />
              </div>
            </Card>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Group</h2>
          <p className="text-sm text-[var(--muted)]">Shared questions and how the team is doing.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Your group progress"
            value={`${group.summary.yourDone}/${group.summary.totalQuestions}`}
            hint="questions done"
          />
          <StatCard label="Your points" value={group.summary.yourPoints} />
          <StatCard
            label="Your readiness"
            value={`${group.summary.yourReadiness}%`}
            hint={`Team avg ${group.summary.avgReadiness}%`}
          />
          <StatCard label="Members" value={group.summary.memberCount} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Group questions by status" subtitle="Your progress on shared questions" />
            <StatusList rows={group.byStatus} />
          </Card>
          <Card>
            <CardHeader title="Group done per day (14d)" />
            <div className="h-52">
              <StudyHoursChart
                data={group.activity.map((d) => ({
                  label: d.label,
                  value: d.count,
                  date: d.date,
                }))}
                valueSuffix="done"
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Group points (14d)" subtitle="From on-time question completion" />
            <div className="h-52">
              <StudyHoursChart
                data={group.pointsTrend.map((d) => ({
                  label: d.label,
                  value: d.count,
                  date: d.date,
                }))}
                color="var(--accent)"
                valueSuffix="pts"
              />
            </div>
          </Card>
          {group.byTrack.length > 0 && (
            <Card>
              <CardHeader title="Group tracks" subtitle="Your % done per shared track" />
              <div className="h-48">
                <SubjectCompletionChart data={group.byTrack.map((t) => ({ label: t.name, value: t.percent }))} />
              </div>
            </Card>
          )}
          {group.leaderboard.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader title="Group leaderboard" subtitle="Points from group questions" />
              <GroupLeaderboardChart
                members={group.leaderboard.map((m) => ({
                  userId: m.userId,
                  name: m.name,
                  totalPoints: m.points,
                  perfect: 0,
                  good: 0,
                  zero: 0,
                  pending: 0,
                  dailyPoints: [],
                }))}
                maxPoints={leaderboardMax}
              />
            </Card>
          )}
          {group.memberReadiness.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader title="Member readiness" />
              <ul className="space-y-2">
                {group.memberReadiness.map((m) => (
                  <li
                    key={m.userId}
                    className="flex items-center justify-between rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
                  >
                    <Link
                      href={`/users/${m.userId}`}
                      className="font-medium text-brand hover:underline"
                    >
                      {m.name}
                      {currentUserId === m.userId ? " (you)" : ""}
                    </Link>
                    <span className="font-semibold text-brand">{m.readiness}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Topics & mocks</h2>
          <p className="text-sm text-[var(--muted)]">Syllabus topics and mock interview history.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {subjectChart.length > 0 && (
            <Card>
              <CardHeader title="Topic completion by subject" />
              <div className="h-56">
                <SubjectCompletionChart data={subjectChart} />
              </div>
            </Card>
          )}
          {topicRows.length > 0 && (
            <Card>
              <CardHeader title="Topic status mix" />
              <StatusList rows={topicRows} />
            </Card>
          )}
          {mockChart.length > 0 && (
            <Card className={subjectChart.length === 0 ? "" : "lg:col-span-2"}>
              <CardHeader title="Mock interview scores" />
              <div className="h-56">
                <MockScoresChart data={mockChart} />
              </div>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
