"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import Card, { CardHeader } from "@/components/ui/Card";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { InterviewPlanSkeleton, ErrorState, EmptyState } from "@/components/ui/StateViews";
import { formatDate } from "@/lib/utils";
import toast from "react-hot-toast";
import type { PreparationPlan } from "@/types";

export default function InterviewPlanPage() {
  const { user } = useUser();
  const [plan, setPlan] = useState<PreparationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    if (!user.activeGroupId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<PreparationPlan>(
        `/api/preparation-plan?groupId=${user.activeGroupId}`
      );
      setPlan(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load plan");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const toggleItem = async (dayNumber: number, itemIndex: number, completed: boolean) => {
    if (!user?.activeGroupId) return;
    try {
      await apiPatch("/api/preparation-plan", {
        groupId: user.activeGroupId,
        dayNumber,
        itemIndex,
        completed,
      });
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update plan item"));
    }
  };

  const regenerate = async () => {
    if (!user?.activeGroupId) return;
    try {
      await apiPost("/api/preparation-plan", { groupId: user.activeGroupId });
      toast.success("Plan regenerated");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to regenerate plan"));
    }
  };

  if (user && !user.activeGroupId) {
    return (
      <EmptyState
        title="No active group"
        description="A preparation plan is tied to your group. Join or create one to get started."
        action={
          <Link href="/groups">
            <Button>Browse Groups</Button>
          </Link>
        }
      />
    );
  }

  if (loading) return <InterviewPlanSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!plan) return null;

  const totalDays = plan.days.length;
  const completedItems = plan.days.reduce(
    (s, d) => s + d.items.filter((i) => i.completed).length,
    0
  );
  const totalItems = plan.days.reduce((s, d) => s + d.items.length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">
            {totalDays}-Day Preparation Plan
          </h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {completedItems}/{totalItems} activities completed · Until {formatDate(plan.endDate)}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={regenerate}>Regenerate Plan</Button>
      </div>

      <div className="space-y-4">
        {plan.days.map((day) => {
          const dayComplete = day.items.length > 0 && day.items.every((i) => i.completed);
          return (
            <Card key={day.dayNumber} className={dayComplete ? "border-emerald-200 dark:border-emerald-800" : ""}>
              <CardHeader
                title={`Day ${day.dayNumber}`}
                subtitle={formatDate(day.date)}
              />
              {day.items.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Rest day or no items scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {day.items.map((item, i) => (
                    <label
                      key={i}
                      className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--border)] p-3 "
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={(e) => toggleItem(day.dayNumber, i, e.target.checked)}
                        className="h-4 w-4 rounded"
                      />
                      <div className="flex-1">
                        <span className={`text-sm font-medium ${item.completed ? "line-through text-[var(--muted)]" : ""}`}>
                          {item.label}
                        </span>
                        <p className="text-xs text-[var(--muted)]">{item.estimatedMinutes} min</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
