import clsx from "clsx";
import { AlertTriangle, ClipboardList } from "lucide-react";
import Button from "./Button";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx("animate-pulse rounded-lg bg-[var(--surface-muted)]", className)}
      aria-hidden
    />
  );
}

export function TaskListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-xl border border-[var(--border)] p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="mt-1 h-4 w-4 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuestionListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:block">
      <div className="space-y-1 p-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl px-4 py-3.5">
            <Skeleton className="h-4 w-[34%]" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageHeaderSkeleton({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {withAction && <Skeleton className="h-9 w-28 shrink-0 rounded-lg" />}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <PageHeaderSkeleton />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-56 w-full rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    </div>
  );
}

export function GroupsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading groups">
      <PageHeaderSkeleton withAction />
      <div className="space-y-4">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--border)] p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
            <Skeleton className="h-4 w-full max-w-md" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-24 rounded-lg" />
              <Skeleton className="h-8 w-28 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GroupShellSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading group">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
    </div>
  );
}

export function GroupDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading group details">
      <div className="flex justify-end gap-2">
        <Skeleton className="h-9 w-24 rounded-lg" />
        <Skeleton className="h-9 w-28 rounded-lg" />
      </div>
      <Skeleton className="h-36 w-full rounded-2xl" />
      <div className="rounded-2xl border border-[var(--border)] p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex gap-4">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-12" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export function SubjectsGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2" aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-[var(--border)] p-5 space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-2 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SubjectsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading subjects">
      <PageHeaderSkeleton withAction />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
      </div>
      <SubjectsGridSkeleton />
    </div>
  );
}

export function TopicsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading topics">
      <PageHeaderSkeleton withAction />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-36" />
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, j) => (
              <Skeleton key={j} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AnalyticsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading analytics">
      <PageHeaderSkeleton />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

export function ProfilePageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading profile">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-40" />
        </div>
        <Skeleton className="h-[72px] w-[72px] rounded-full" />
      </div>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}

export function InterviewPlanSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading preparation plan">
      <PageHeaderSkeleton withAction />
      <Skeleton className="h-20 w-full rounded-2xl" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-2xl border border-[var(--border)] p-5 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </div>
      ))}
    </div>
  );
}

export function MockInterviewsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading mock interviews">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export function TasksPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading tasks">
      <PageHeaderSkeleton withAction />
      <Skeleton className="h-20 w-full rounded-2xl" />
      <TaskListSkeleton rows={5} />
    </div>
  );
}

export function QuestionsPageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading questions">
      <PageHeaderSkeleton withAction />
      <TaskListSkeleton rows={3} />
      <QuestionListSkeleton />
    </div>
  );
}

export function SettingsPageSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-5 pb-8" aria-busy="true" aria-label="Loading settings">
      <PageHeaderSkeleton withAction />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-44 w-full rounded-2xl" />
    </div>
  );
}

export function AppShellSkeleton() {
  return (
    <div className="fixed inset-0 flex overflow-hidden" aria-busy="true" aria-label="Loading GrowthHub">
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] p-3 lg:flex">
        <Skeleton className="mb-6 h-10 w-full rounded-lg" />
        <div className="space-y-1">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
        <div className="mt-auto space-y-2 border-t border-[var(--border)] pt-4">
          <Skeleton className="h-9 w-full rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <DashboardSkeleton />
          </div>
        </main>
      </div>
    </div>
  );
}

function IconBadge({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-muted)]">
      {children}
    </div>
  );
}

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      <p className="mt-3 text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <IconBadge>
        <ClipboardList className="h-7 w-7 text-[var(--muted)]" strokeWidth={1.5} />
      </IconBadge>
      <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <IconBadge>
        <AlertTriangle className="h-7 w-7 text-warning" strokeWidth={1.5} />
      </IconBadge>
      <h3 className="text-lg font-semibold text-[var(--foreground)]">Something went wrong</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{message}</p>
      {onRetry && (
        <Button variant="ghost" size="sm" onClick={onRetry} className="mt-4">
          Try again
        </Button>
      )}
    </div>
  );
}
