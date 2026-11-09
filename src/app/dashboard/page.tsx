"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPatch, getErrorMessage } from "@/lib/api";
import TablePagination from "@/components/ui/TablePagination";
import { normalizeQuestionStatus, sliceTablePage, TABLE_PAGE_SIZE } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  triggerQuestionPointsBurst,
  type QuestionPointBurst,
} from "@/lib/question-points-burst";
import InspirationCard from "@/components/dashboard/InspirationCard";
import NotesInbox from "@/components/groups/NotesInbox";
import TodayPlanCard from "@/components/dashboard/TodayPlanCard";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
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
  const [memberPage, setMemberPage] = useState(1);

  const activeGroupId = user?.activeGroupId;
  const memberPageItems = useMemo(
    () => sliceTablePage(data?.memberStats ?? [], memberPage, TABLE_PAGE_SIZE),
    [data?.memberStats, memberPage]
  );

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
    if (!data) return;
    const current =
      data.todayQuestions.group.find((q) => String(q._id) === String(id)) ??
      data.todayQuestions.personal.find((q) => String(q._id) === String(id));
    if (!current) return;
    const previousStatus = normalizeQuestionStatus(current.status ?? "not_started");

    const updateList = (list: typeof data.todayQuestions.group) =>
      list.map((q) => (String(q._id) === String(id) ? { ...q, status: normalized } : q));
    setData({
      ...data,
      todayQuestions: {
        group: updateList(data.todayQuestions.group),
        personal: updateList(data.todayQuestions.personal),
      },
    });

    try {
      const updated = await apiPatch<{ status?: QuestionStatus; pointsEarnedNow?: number }>(
        `/api/practice-questions/${id}`,
        { status: normalized }
      );
      const savedStatus = normalizeQuestionStatus(updated.status ?? normalized);
      setData((prev) => {
        if (!prev) return prev;
        const updateList = (list: typeof prev.todayQuestions.group) =>
          list.map((q) => (String(q._id) === String(id) ? { ...q, status: savedStatus } : q));
        return {
          ...prev,
          todayQuestions: {
            group: updateList(prev.todayQuestions.group),
            personal: updateList(prev.todayQuestions.personal),
          },
        };
      });
      triggerQuestionPointsBurst(setPointBurst, id, updated.pointsEarnedNow);
      if (normalized === "add_to_todo") {
        toast.success("Added to Tasks");
      }
    } catch (err) {
      setData((prev) => {
        if (!prev) return prev;
        const updateList = (list: typeof prev.todayQuestions.group) =>
          list.map((q) => (String(q._id) === String(id) ? { ...q, status: previousStatus } : q));
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
          <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="pb-2 font-medium">Member</th>
                  <th className="pb-2 font-medium">Tasks Done</th>
                </tr>
              </thead>
              <tbody>
                {memberPageItems.map((m) => (
                  <tr key={m.userId} className="table-row">
                    <td className="py-2 font-medium">
                      <Link href={`/users/${m.userId}`} className="text-brand hover:underline">
                        {m.name}
                      </Link>
                    </td>
                    <td className="py-2">{m.tasksCompleted}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <TablePagination
              page={memberPage}
              total={data.memberStats.length}
              onPageChange={setMemberPage}
            />
          </div>
          </>
        ) : (
          <p className="text-sm text-[var(--muted)]">No group members yet.</p>
        )}
      </Card>

      <NotesInbox groupId={user!.activeGroupId!} compact />

      <TodayPlanCard
        todayQuestions={data.todayQuestions}
        onStatusChange={updateQuestionStatus}
        pointBurst={pointBurst}
      />

      <InspirationCard
        studyStreak={data.studyStreak}
        daysToInterview={data.countdown.days}
        targetCtcLpa={user?.targetCtcLpa}
      />
    </div>
  );
}
