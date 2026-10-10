import { addIstDays, istDateKey, normalizeQuestionStatus, startOfDay } from "@/lib/utils";
const STATUS_LABELS: Record<string, string> = {
  not_started: "Not started",
  add_to_todo: "To do",
  in_progress: "In progress",
  revised: "Revised",
  done: "Done",
};

export function questionStatusLabel(status: string): string {
  const key = normalizeQuestionStatus(status);
  return STATUS_LABELS[key] ?? key;
}

export function countQuestionsByStatus(statuses: string[]) {
  const counts = new Map<string, number>();
  for (const raw of statuses) {
    const status = normalizeQuestionStatus(raw);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([status, count]) => ({
      status,
      label: questionStatusLabel(status),
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

export function isQuestionDone(status: string): boolean {
  const s = normalizeQuestionStatus(status);
  return s === "done" || s === "revised";
}

export function activityByDay(
  items: {
    status: string;
    completedAt?: Date | string | null;
    practiceDate?: Date | string | null;
  }[],
  days = 14,
  now = new Date()
): { date: string; label: string; count: number }[] {
  const start = startOfDay(addIstDays(now, -(days - 1)));
  const buckets = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    const key = istDateKey(addIstDays(start, i));
    buckets.set(key, 0);
  }

  for (const item of items) {
    if (!isQuestionDone(item.status)) continue;
    const when =
      item.completedAt ??
      item.practiceDate ??
      null;
    if (!when) continue;
    const key = istDateKey(new Date(when));
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return Array.from(buckets.entries()).map(([date, count]) => ({
    date,
    label: formatChartDayLabel(date),
    count,
  }));
}

/** Compact axis label (IST), e.g. "9 Oct" — avoids crowded weekday strings on 14-day charts. */
function formatChartDayLabel(dateKey: string): string {
  const dt = new Date(`${dateKey}T12:00:00+05:30`);
  return dt.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  });
}

export type TrackProgress = {
  name: string;
  total: number;
  done: number;
  percent: number;
};

export function trackProgress(
  questions: { subjectId: unknown; status: string }[],
  subjectNames: Map<string, string>
): TrackProgress[] {
  const bySubject = new Map<string, { total: number; done: number }>();
  for (const q of questions) {
    const sid = String(q.subjectId);
    const row = bySubject.get(sid) ?? { total: 0, done: 0 };
    row.total++;
    if (isQuestionDone(q.status)) row.done++;
    bySubject.set(sid, row);
  }

  return Array.from(bySubject.entries())
    .map(([sid, { total, done }]) => ({
      name: subjectNames.get(sid) ?? "Track",
      total,
      done,
      percent: total > 0 ? Math.round((done / total) * 100) : 0,
    }))
    .sort((a, b) => b.percent - a.percent);
}
