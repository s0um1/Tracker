import type { QuestionStatus } from "@/types";
import { generateAuthCode } from "@/lib/auth";

export const MAX_GROUP_MEMBERS = 5;

export function isGroupFull(memberCount: number): boolean {
  return memberCount >= MAX_GROUP_MEMBERS;
}

export const JOIN_CODE_TTL_MINUTES = 15;
export const JOIN_CODE_TTL_MS = JOIN_CODE_TTL_MINUTES * 60 * 1000;

export function generateJoinCode(): string {
  return generateAuthCode();
}

export function normalizeJoinCode(code: string): string {
  return code.trim().replace(/\D/g, "");
}

export function isValidJoinCode(code: string): boolean {
  return /^\d{6}$/.test(normalizeJoinCode(code));
}

export function needsJoinCodeReissue(
  joinCode: string,
  expiresAt?: string | Date | null
): boolean {
  return !isJoinCodeActive(joinCode, expiresAt);
}

export function joinCodeExpiryDate(from = new Date()): Date {
  return new Date(from.getTime() + JOIN_CODE_TTL_MS);
}

function joinCodeExpiryMs(expiresAt?: string | Date | null): number | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime();
  return Number.isNaN(ms) ? null : ms;
}

export function isJoinCodeExpired(expiresAt?: string | Date | null): boolean {
  const exp = joinCodeExpiryMs(expiresAt);
  if (exp === null) return true;
  return exp <= Date.now();
}

/** Active short-lived invite (15m TTL). Ignores legacy/demo rows with far-future expiry. */
export function isJoinCodeActive(joinCode: string, expiresAt?: string | Date | null): boolean {
  if (!isValidJoinCode(joinCode)) return false;
  const exp = joinCodeExpiryMs(expiresAt);
  if (exp === null || exp <= Date.now()) return false;
  const remaining = exp - Date.now();
  return remaining <= JOIN_CODE_TTL_MS + 60_000;
}

export function joinCodeSecondsRemaining(expiresAt?: string | Date | null): number {
  const exp = joinCodeExpiryMs(expiresAt);
  if (exp === null) return 0;
  return Math.max(0, Math.ceil((exp - Date.now()) / 1000));
}

export function formatJoinCodeCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function jsonOk<T>(data: T, init?: number) {
  return Response.json({ success: true, data }, { status: init ?? 200 });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ success: false, error: message }, { status });
}

export type ContentUnit = "questions" | "videos" | "chapters" | "problems";

export const CONTENT_UNIT_LABELS: Record<ContentUnit, string> = {
  questions: "Questions",
  videos: "Videos",
  chapters: "Chapters",
  problems: "Problems",
};

export function formatSubjectTrack(subject: {
  name: string;
  totalQuestions?: number;
  contentUnit?: ContentUnit;
}): string {
  const count = subject.totalQuestions ?? 0;
  if (count > 0) return `${subject.name} (${count})`;
  return subject.name;
}

export const APP_TIMEZONE = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function istDateParts(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day") };
}

function istTimeParts(date: Date): { h: number; min: number } {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { h: get("hour"), min: get("minute") };
}

export function istDateKey(date: Date): string {
  const { y, m, d } = istDateParts(date);
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

export function istDateFromParts(y: number, m: number, d: number, h = 0, min = 0): Date {
  return new Date(`${y}-${pad2(m)}-${pad2(d)}T${pad2(h)}:${pad2(min)}:00${IST_OFFSET}`);
}

export function isSameIstDay(a: string | Date, b: string | Date = new Date()): boolean {
  return istDateKey(new Date(a)) === istDateKey(new Date(b));
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-IN", {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
}

export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    timeZone: APP_TIMEZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatInterviewDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-IN", {
    timeZone: APP_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Start of calendar day in IST. */
export function startOfDay(date: Date): Date {
  const { y, m, d } = istDateParts(date);
  return istDateFromParts(y, m, d);
}

export function addIstDays(date: Date, days: number): Date {
  return startOfDay(new Date(date.getTime() + days * 86400000));
}

export function toDateInputValue(date: Date | string = new Date()): string {
  return istDateKey(new Date(date));
}

export function toDateTimeLocalValue(date?: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "";
  const { y, m, d: day } = istDateParts(d);
  const { h, min } = istTimeParts(d);
  return `${y}-${pad2(m)}-${pad2(day)}T${pad2(h)}:${pad2(min)}`;
}

export function parseDateInput(value: string): Date {
  const [y, m, day] = value.split("-").map(Number);
  return istDateFromParts(y, m, day);
}

/** Parse `<input type="datetime-local">` values as IST wall time. */
export function parseAppDateTime(value: string | Date): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    const [datePart, timePart] = value.split("T");
    const [y, m, d] = datePart.split("-").map(Number);
    const [h, min] = timePart.split(":").map(Number);
    return istDateFromParts(y, m, d, h, min);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return parseDateInput(value);
  return new Date(value);
}

export function questionPracticeDay(q: { practiceDate?: Date | string; createdAt: Date | string }): string {
  const d = q.practiceDate ? new Date(q.practiceDate) : new Date(q.createdAt);
  return toDateInputValue(d);
}

export function questionPreview(content: string, maxLen = 80): string {
  const line = content.split("\n")[0];
  return line.length > maxLen ? `${line.slice(0, maxLen)}…` : line;
}

const QUESTION_BODY_SEP = "\n\n";

export function joinQuestionFields(title: string, description?: string): string {
  const t = title.trim();
  const d = description?.trim() ?? "";
  if (!t) return d;
  if (!d) return t;
  return `${t}${QUESTION_BODY_SEP}${d}`;
}

export function splitQuestionFields(content: string): { title: string; description: string } {
  const trimmed = content.trim();
  if (!trimmed) return { title: "", description: "" };
  const idx = trimmed.indexOf(QUESTION_BODY_SEP);
  if (idx === -1) return { title: trimmed, description: "" };
  return {
    title: trimmed.slice(0, idx).trim(),
    description: trimmed.slice(idx + QUESTION_BODY_SEP.length).trim(),
  };
}

export function resolveQuestionBody(body: {
  content?: string;
  title?: string;
  description?: string;
}): { content: string } | { error: string } {
  const title = body.title?.trim();
  const description = body.description?.trim() ?? "";
  if (title) {
    return { content: joinQuestionFields(title, description) };
  }
  const legacy = body.content?.trim();
  if (legacy) return { content: legacy };
  return { error: "Question title is required" };
}

export function isExpandableQuestion(content: string): boolean {
  const { description } = splitQuestionFields(content);
  if (description) return description.length > 80 || description.includes("\n");
  return content.includes("\n") || content.length > 120;
}

export type QuestionDatePeriod = "today" | "tomorrow" | "yesterday" | "month" | "all";

export const QUESTION_DATE_PERIODS: { id: QuestionDatePeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "yesterday", label: "Yesterday" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];

export function questionDatePeriodRange(period: QuestionDatePeriod): { start: Date; end: Date } | null {
  if (period === "all") return null;

  const today = startOfDay(new Date());

  switch (period) {
    case "today":
      return { start: today, end: addIstDays(today, 1) };
    case "tomorrow":
      return { start: addIstDays(today, 1), end: addIstDays(today, 2) };
    case "yesterday":
      return { start: addIstDays(today, -1), end: today };
    case "month": {
      const { y, m } = istDateParts(today);
      const start = istDateFromParts(y, m, 1);
      const endM = m === 12 ? 1 : m + 1;
      const endY = m === 12 ? y + 1 : y;
      const end = istDateFromParts(endY, endM, 1);
      return { start, end };
    }
    default:
      return null;
  }
}

export function serializeDoc(doc: unknown): Record<string, unknown> & { _id: string } {
  const raw =
    doc && typeof doc === "object" && "toObject" in doc && typeof (doc as { toObject: () => unknown }).toObject === "function"
      ? (doc as { toObject: () => unknown }).toObject()
      : doc;
  const obj = { ...(raw as Record<string, unknown>) };
  obj._id = String(obj._id);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (val && typeof val === "object" && "_bsontype" in (val as object)) {
      obj[key] = String(val);
    }
  }
  return obj as Record<string, unknown> & { _id: string };
}

export const PRIORITY_META: Record<
  "critical" | "high" | "medium" | "low",
  { label: string; color: string; bg: string; border: string }
> = {
  critical: { label: "Critical", color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  high: { label: "High", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  medium: { label: "Medium", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  low: { label: "Low", color: "text-[var(--muted)]", bg: "bg-[var(--surface-muted)]", border: "border-[var(--border)]" },
};

export const TOPIC_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; progress: number }
> = {
  not_started: { label: "Not Started", color: "text-[var(--muted)]", bg: "bg-[var(--surface-muted)]", border: "border-[var(--border)]", progress: 0 },
  learning: { label: "Learning", color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200", progress: 25 },
  practiced: { label: "Practiced", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", progress: 50 },
  revised: { label: "Revised", color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200", progress: 75 },
  interview_ready: { label: "Interview Ready", color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", progress: 100 },
};

export const TASK_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "Pending", color: "text-[var(--muted)]", bg: "bg-[var(--surface-muted)]" },
  in_progress: { label: "In Progress", color: "text-blue-600", bg: "bg-blue-50" },
  completed: { label: "Completed", color: "text-emerald-600", bg: "bg-emerald-50" },
};

export const QUESTION_STATUS_ORDER: QuestionStatus[] = [
  "not_started",
  "add_to_todo",
  "in_progress",
  "revised",
  "done",
];

const LEGACY_QUESTION_STATUS: Record<string, QuestionStatus> = {
  not_attempted: "not_started",
  practiced: "in_progress",
  struggled: "in_progress",
  mastered: "done",
};

export function normalizeQuestionStatus(status: string): QuestionStatus {
  if (QUESTION_STATUS_ORDER.includes(status as QuestionStatus)) {
    return status as QuestionStatus;
  }
  return LEGACY_QUESTION_STATUS[status] ?? "not_started";
}

export type QuestionSortField = "date" | "status" | "track" | "scope";
export type QuestionSortDir = "asc" | "desc";

export function questionStatusSortIndex(status: string): number {
  const i = QUESTION_STATUS_ORDER.indexOf(normalizeQuestionStatus(status));
  return i === -1 ? QUESTION_STATUS_ORDER.length : i;
}

export function compareQuestions<
  T extends {
    practiceDate?: string;
    createdAt?: string;
    status: string;
    scope?: string;
    trackLabel?: string;
    subjectName?: string;
  },
>(a: T, b: T, sortBy: QuestionSortField, sortDir: QuestionSortDir): number {
  const dir = sortDir === "asc" ? 1 : -1;
  if (sortBy === "date") {
    const da = new Date(a.practiceDate ?? a.createdAt ?? 0).getTime();
    const db = new Date(b.practiceDate ?? b.createdAt ?? 0).getTime();
    return (da - db) * dir;
  }
  if (sortBy === "status") {
    return (questionStatusSortIndex(a.status) - questionStatusSortIndex(b.status)) * dir;
  }
  if (sortBy === "scope") {
    return (a.scope ?? "").localeCompare(b.scope ?? "") * dir;
  }
  const ta = (a.trackLabel || a.subjectName || "").toLowerCase();
  const tb = (b.trackLabel || b.subjectName || "").toLowerCase();
  return ta.localeCompare(tb) * dir;
}

export function questionRowVars(status: QuestionStatus): Record<string, string> {
  const key = normalizeQuestionStatus(status);
  return {
    "--qs-row-border": `var(--qs-${key}-border)`,
    "--qs-row-bg": `var(--qs-${key}-row)`,
    "--qs-row-bg-hover": `var(--qs-${key}-row-hover)`,
  };
}

export function isQuestionStatusPracticed(status: QuestionStatus): boolean {
  return status === "in_progress" || status === "revised" || status === "done";
}

export const QUESTION_STATUS_META: Record<
  QuestionStatus,
  {
    label: string;
    dot: string;
    bg: string;
    border: string;
    text: string;
    rowBorder: string;
    rowBg: string;
  }
> = {
  not_started: {
    label: "Not Started",
    dot: "#ef4444",
    bg: "qs-not_started",
    border: "",
    text: "",
    rowBorder: "border-l-red-400 dark:border-l-red-400",
    rowBg: "hover:bg-red-500/5 dark:hover:bg-red-400/10",
  },
  add_to_todo: {
    label: "Add to do",
    dot: "#8b5cf6",
    bg: "qs-add_to_todo",
    border: "",
    text: "",
    rowBorder: "border-l-violet-400 dark:border-l-violet-400",
    rowBg: "hover:bg-violet-500/5 dark:hover:bg-violet-400/10",
  },
  in_progress: {
    label: "In Progress",
    dot: "#eab308",
    bg: "qs-in_progress",
    border: "",
    text: "",
    rowBorder: "border-l-yellow-400 dark:border-l-yellow-400",
    rowBg: "hover:bg-yellow-500/5 dark:hover:bg-yellow-400/10",
  },
  revised: {
    label: "Revised",
    dot: "#3b82f6",
    bg: "qs-revised",
    border: "",
    text: "",
    rowBorder: "border-l-blue-400 dark:border-l-blue-400",
    rowBg: "hover:bg-blue-500/5 dark:hover:bg-blue-400/10",
  },
  done: {
    label: "Done",
    dot: "#22c55e",
    bg: "qs-done",
    border: "",
    text: "",
    rowBorder: "border-l-emerald-400 dark:border-l-emerald-400",
    rowBg: "hover:bg-emerald-500/5 dark:hover:bg-emerald-400/10",
  },
};

