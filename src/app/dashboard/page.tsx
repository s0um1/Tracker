"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPatch, getErrorMessage } from "@/lib/api";
import { normalizeQuestionStatus } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  triggerQuestionPointsBurst,
  type QuestionPointBurst,
} from "@/lib/question-points-burst";
import { ReadinessCard } from "@/components/dashboard/CountdownBanner";
import InspirationCard from "@/components/dashboard/InspirationCard";
import TodayPlanCard from "@/components/dashboard/TodayPlanCard";
import FocusTimer from "@/components/focus/FocusTimer";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { ConfidenceBadge } from "@/components/ui/Badge";
import PageHeader from "@/components/ui/PageHeader";
import { DashboardSkeleton, ErrorState, EmptyState } from "@/components/ui/StateViews";
import type { DashboardData, QuestionStatus } from "@/types";

export default function DashboardPage() {
  const { user, refreshUser } = useUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [pointBurst, setPointBurst] = useState<QuestionPointBurst | null>(null);

  const activeGroupId = user?.activeGroupId;

  const load = useCallback(async (silent = false) => {
    if (!user?._id) return;
    if (!activeGroupId) {
      setInitialLoad(false);
      setRefreshing(false);
      return;
    }
    if (silent) setRefreshing(true);
    else setInitialLoad(true);
    try {
      const d = await apiGet<DashboardData>("/api/dashboard");
      setData(d);
      setError("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load dashboard";
      if (message === "No active group") {
        await refreshUser();
        setData(null);
        setError("");
      } else {
        setError(message);
      }
    } finally {
      setInitialLoad(false);
      setRefreshing(false);
    }
  }, [user?._id, activeGroupId, refreshUser]);

  useEffect(() => { load(); }, [load]);

  const updateQuestionStatus = async (id: string, status: QuestionStatus) => {
    const normalized = normalizeQuestionStatus(status);
    let previousStatus: QuestionStatus | undefined;
    setData((prev) => {
      if (!prev) return prev;
      const current =
        prev.todayQuestions.group.find((q) => q._id === id) ??
        prev.todayQuestions.personal.find((q) => q._id === id);
      if (!current) return prev;
      previousStatus = current.status;
      const updateList = (list: typeof prev.todayQuestions.group) =>
        list.map((q) => (q._id === id ? { ...q, status: normalized } : q));
      return {
        ...prev,
        todayQuestions: {
          group: updateList(prev.todayQuestions.group),
          personal: updateList(prev.todayQuestions.personal),
        },
      };
    });
    if (!previousStatus) return;

    try {
      const updated = await apiPatch<{ pointsEarnedNow?: number }>(
        `/api/practice-questions/${id}`,
        { status: normalized }
      );
      triggerQuestionPointsBurst(setPointBurst, id, updated.pointsEarnedNow);
      if (normalized === "add_to_todo") {
        toast.success("Added to Tasks");
      }
    } catch (err) {
      setData((prev) => {
        if (!prev) return prev;
        const updateList = (list: typeof prev.todayQuestions.group) =>
          list.map((q) => (q._id === id ? { ...q, status: previousStatus! } : q));
        return {
          ...prev,
          todayQuestions: {
            group: updateList(prev.todayQuestions.group),
            personal: updateList(prev.todayQuestions.personal),
          },
        };
      });
      toast.error(getErrorMessage(err, "Failed to update question"));
    }
  };

  if (initialLoad && user?.activeGroupId) return <DashboardSkeleton />;
  if (user && !user.activeGroupId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title={`Welcome back, ${user.name?.split(" ")[0]}`}
          description="Join or create a group to unlock your dashboard."
        />
        <EmptyState
          title="No active group"
          description="Create a prep group or join one with an invite code to track progress together."
          action={
            <Link href="/groups">
              <Button>Browse Groups</Button>
            </Link>
          }
        />
      </div>
    );
  }
  if (error && !data) return <ErrorState message={error} onRetry={() => load()} />;
  if (!data) return null;

  return (
    <div className={refreshing ? "space-y-6 opacity-80 transition-opacity" : "space-y-6"}>
      <PageHeader
        title={`Welcome back, ${user?.name?.split(" ")[0]}`}
        description="Here's where you stand today."
      />

      <Card>
        <CardHeader
          title="Group Progress"
          action={
            <Link href={user?.activeGroupId ? `/groups/${user.activeGroupId}` : "/groups"}>
              <Button variant="ghost" size="sm">View Group</Button>
            </Link>
          }
        />
        {data.memberStats && data.memberStats.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="pb-2 font-medium">Member</th>
                  <th className="pb-2 font-medium">Readiness</th>
                  <th className="pb-2 font-medium">Tasks Done</th>
                </tr>
              </thead>
              <tbody>
                {data.memberStats.map((m) => (
                  <tr key={m.userId} className="table-row">
                    <td className="py-2 font-medium">
                      <Link href={`/users/${m.userId}`} className="text-brand hover:underline">
                        {m.name}
                      </Link>
                    </td>
                    <td className="py-2">{m.readiness}%</td>
                    <td className="py-2">{m.tasksCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">No group members yet.</p>
        )}
      </Card>

      <TodayPlanCard
        todayQuestions={data.todayQuestions}
        onStatusChange={updateQuestionStatus}
        pointBurst={pointBurst}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div id="focus-timer">
          <FocusTimer
            groupId={user!.activeGroupId}
            label="Start a focus session"
            onComplete={() => load(true)}
          />
        </div>

        <Card>
          <CardHeader
            title="Focus Areas"
            action={<Link href="/subjects"><Button variant="ghost" size="sm">View All</Button></Link>}
          />
          {data.weakSubjects.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No weak subjects detected. Keep it up!</p>
          ) : (
            <div className="space-y-3">
              {data.weakSubjects.map((s) => (
                <div key={s._id} className="rounded-xl border border-[var(--border)] p-3 ">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[var(--foreground)]">{s.name}</span>
                    <ConfidenceBadge confidence={s.confidence} />
                  </div>
                  <ProgressBar value={s.completionPercent} className="mt-2" />
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {s.questionCount}{s.totalQuestions > 0 ? ` / ${s.totalQuestions}` : ""} questions · {s.completionPercent}% prepared
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <InspirationCard
        readiness={data.readiness}
        studyStreak={data.studyStreak}
        daysToInterview={data.countdown.days}
        targetCtcLpa={user?.targetCtcLpa}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ReadinessCard readiness={data.readiness} />
        <Card>
          <CardHeader title="Quick Stats" />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Questions Today" value={String(data.questionsToday)} />
            <Stat label="Study Streak" value={`${data.studyStreak} days`} />
            <Stat label="Group Readiness" value={`${data.groupReadiness ?? 0}%`} />
          </div>
        </Card>
      </div>

    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-muted p-3">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-lg font-bold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
