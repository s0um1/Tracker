"use client";

import { useEffect, useState, useCallback, useMemo, memo } from "react";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPost, apiPatch, apiDelete, getErrorMessage } from "@/lib/api";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import MotivationBanner from "@/components/dashboard/MotivationBanner";
import TaskRow, { type TaskWithNames } from "@/components/tasks/TaskRow";
import { ErrorState, EmptyState, TasksPageSkeleton } from "@/components/ui/StateViews";
import toast from "react-hot-toast";

export default function TasksPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<TaskWithNames[]>([]);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPriority, setNewPriority] = useState<"critical" | "high" | "medium" | "low">("medium");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(() => new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(() => new Set());

  const activeGroupId = user?.activeGroupId;

  const fetchTasks = useCallback(async () => {
    if (!activeGroupId) return [];
    return apiGet<TaskWithNames[]>(`/api/tasks?groupId=${activeGroupId}`);
  }, [activeGroupId]);

  useEffect(() => {
    let cancelled = false;
    setInitialLoad(true);
    setError("");
    fetchTasks()
      .then((data) => {
        if (!cancelled) setTasks(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load tasks");
        }
      })
      .finally(() => {
        if (!cancelled) setInitialLoad(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchTasks]);

  const setUpdating = useCallback((id: string, active: boolean) => {
    setUpdatingIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const setDeleting = useCallback((id: string, active: boolean) => {
    setDeletingIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const createTask = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    try {
      const created = await apiPost<TaskWithNames>("/api/tasks", {
        groupId: user.activeGroupId,
        title: newTitle,
        priority: newPriority,
      });
      setTasks((prev) => [...prev, created]);
      toast.success("Task created");
      setShowModal(false);
      setNewTitle("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create task"));
    } finally {
      setCreating(false);
    }
  };

  const toggleTask = useCallback(
    async (taskId: string) => {
      if (updatingIds.has(taskId) || deletingIds.has(taskId)) return;

      let previousStatus: TaskWithNames["status"] | undefined;
      setUpdating(taskId, true);
      setTasks((prev) => {
        const task = prev.find((t) => t._id === taskId);
        if (!task) return prev;
        previousStatus = task.status;
        const nextStatus = task.status === "completed" ? "pending" : "completed";
        return prev.map((t) => (t._id === taskId ? { ...t, status: nextStatus } : t));
      });

      if (!previousStatus) {
        setUpdating(taskId, false);
        return;
      }

      const nextStatus = previousStatus === "completed" ? "pending" : "completed";
      try {
        await apiPatch(`/api/tasks/${taskId}`, { status: nextStatus });
      } catch (err) {
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? { ...t, status: previousStatus! } : t))
        );
        toast.error(getErrorMessage(err, "Failed to update task"));
      } finally {
        setUpdating(taskId, false);
      }
    },
    [updatingIds, deletingIds, setUpdating]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      if (updatingIds.has(taskId) || deletingIds.has(taskId)) return;

      let removed: TaskWithNames | undefined;
      setDeleting(taskId, true);
      setTasks((prev) => {
        removed = prev.find((t) => t._id === taskId);
        return prev.filter((t) => t._id !== taskId);
      });

      if (!removed) {
        setDeleting(taskId, false);
        return;
      }

      try {
        await apiDelete(`/api/tasks/${taskId}`);
        toast.success("Task deleted");
      } catch (err) {
        setTasks((prev) => [...prev, removed!]);
        toast.error(getErrorMessage(err, "Failed to delete task"));
      } finally {
        setDeleting(taskId, false);
      }
    },
    [updatingIds, deletingIds, setDeleting]
  );

  const pending = useMemo(
    () => tasks.filter((t) => t.status !== "completed"),
    [tasks]
  );
  const completed = useMemo(
    () => tasks.filter((t) => t.status === "completed"),
    [tasks]
  );

  if (initialLoad) {
    return <TasksPageSkeleton />;
  }

  if (error && tasks.length === 0) {
    return <ErrorState message={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Tasks</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {`${pending.length} pending · ${completed.length} completed`}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)}>
          Add Task
        </Button>
      </div>

      <MotivationBanner />

      {tasks.length === 0 ? (
        <EmptyState
          title="No tasks yet"
          description="Add tasks to track what needs to be done."
          action={<Button onClick={() => setShowModal(true)}>Add Task</Button>}
        />
      ) : (
        <div className="space-y-4">
          {pending.length > 0 && (
            <TaskSection
              title="To Do"
              tasks={pending}
              updatingIds={updatingIds}
              deletingIds={deletingIds}
              onToggle={toggleTask}
              onDelete={deleteTask}
            />
          )}
          {completed.length > 0 && (
            <TaskSection
              title="Completed"
              tasks={completed}
              updatingIds={updatingIds}
              deletingIds={deletingIds}
              onToggle={toggleTask}
              onDelete={deleteTask}
            />
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Task">
        <div className="space-y-4">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Task title"
            className="w-full rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            autoFocus
          />
          <select
            value={newPriority}
            onChange={(e) => setNewPriority(e.target.value as typeof newPriority)}
            className="w-full rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
          >
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <Button onClick={createTask} className="w-full" disabled={creating}>
            {creating ? "Creating…" : "Create Task"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

const TaskSection = memo(function TaskSection({
  title,
  tasks,
  updatingIds,
  deletingIds,
  onToggle,
  onDelete,
}: {
  title: string;
  tasks: TaskWithNames[];
  updatingIds: Set<string>;
  deletingIds: Set<string>;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-[var(--muted)]">{title}</h2>
      <div className="divide-y divide-[color-mix(in_srgb,var(--border)_60%,transparent)]">
        {tasks.map((t) => (
          <TaskRow
            key={t._id}
            task={t}
            updating={updatingIds.has(t._id)}
            deleting={deletingIds.has(t._id)}
            onToggle={onToggle}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
});
