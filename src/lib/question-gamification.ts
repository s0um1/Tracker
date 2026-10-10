import { addIstDays, istDateKey, startOfDay, normalizeQuestionStatus } from "@/lib/utils";
import type { QuestionStatus } from "@/types";

export const QUESTION_POINT_ON_TIME = 10;
export const QUESTION_POINT_NEXT_DAY = 5;

export type QuestionPointBucket = "perfect" | "good" | "zero" | "pending";

export function daysAfterDue(practiceDate: Date | string, completedAt: Date | string): number {
  const due = startOfDay(new Date(practiceDate)).getTime();
  const done = startOfDay(new Date(completedAt)).getTime();
  return Math.floor((done - due) / 86400000);
}

/** Due date +10, next day +5, then −1 per day until 0 (4, 3, 2, 1, 0). */
export function pointsForDaysLate(daysLate: number): number {
  if (daysLate <= 0) return QUESTION_POINT_ON_TIME;
  if (daysLate === 1) return QUESTION_POINT_NEXT_DAY;
  return Math.max(0, QUESTION_POINT_NEXT_DAY - (daysLate - 1));
}

export function pointsBucket(points: number): QuestionPointBucket {
  if (points === QUESTION_POINT_ON_TIME) return "perfect";
  if (points === QUESTION_POINT_NEXT_DAY) return "good";
  return "zero";
}

/** Award points once on first transition to done; re-marking done does not re-score. */
export function applyFirstDonePoints(
  prevStatus: string,
  nextStatus: string,
  practiceDate: Date | string,
  existing?: { pointsAwarded?: number | null; firstCompletedAt?: Date | string | null }
): { pointsAwarded?: number; firstCompletedAt?: Date; pointsEarnedNow?: number } {
  if (existing?.pointsAwarded != null) {
    return {
      pointsAwarded: existing.pointsAwarded,
      firstCompletedAt: existing.firstCompletedAt
        ? new Date(existing.firstCompletedAt)
        : undefined,
    };
  }

  const next = normalizeQuestionStatus(nextStatus);
  if (next !== "done") return {};

  const completedAt = new Date();
  const { points } = questionCompletionPoints("done", practiceDate, completedAt, completedAt);
  const firstCompletedAt = existing?.firstCompletedAt
    ? new Date(existing.firstCompletedAt)
    : completedAt;

  return {
    pointsAwarded: points,
    firstCompletedAt,
    pointsEarnedNow: points,
  };
}

export function questionCompletionPoints(
  status: string,
  practiceDate: Date | string,
  lastPracticed?: Date | string | null,
  now = new Date()
): { points: number; bucket: QuestionPointBucket } {
  const normalized = normalizeQuestionStatus(status);
  const due = startOfDay(new Date(practiceDate));
  const today = startOfDay(now);

  if (normalized === "not_started" || normalized === "add_to_todo") {
    if (today.getTime() > due.getTime()) return { points: 0, bucket: "zero" };
    return { points: 0, bucket: "pending" };
  }

  if (!lastPracticed) return { points: 0, bucket: "zero" };

  const daysLate = daysAfterDue(practiceDate, lastPracticed);
  const points = pointsForDaysLate(daysLate);
  if (points === QUESTION_POINT_ON_TIME) return { points, bucket: "perfect" };
  if (points === QUESTION_POINT_NEXT_DAY) return { points, bucket: "good" };
  return { points, bucket: "zero" };
}

export type QuestionGamificationInput = {
  _id: string;
  practiceDate: Date | string;
  createdAt?: Date | string;
  status: QuestionStatus | string;
  lastPracticed?: Date | string | null;
  firstCompletedAt?: Date | string | null;
  pointsAwarded?: number | null;
};

function resolveAwardedPoints(
  q: QuestionGamificationInput,
  now = new Date()
): { points: number; bucket: QuestionPointBucket; awardedAt?: Date } {
  if (q.pointsAwarded != null) {
    return {
      points: q.pointsAwarded,
      bucket: pointsBucket(q.pointsAwarded),
      awardedAt: q.firstCompletedAt ? new Date(q.firstCompletedAt) : undefined,
    };
  }

  const normalized = normalizeQuestionStatus(q.status);
  if (normalized === "not_started" || normalized === "add_to_todo") {
    const due = startOfDay(new Date(q.practiceDate ?? q.createdAt ?? now));
    if (startOfDay(now).getTime() > due.getTime()) return { points: 0, bucket: "zero" };
    return { points: 0, bucket: "pending" };
  }

  if (normalized === "done" && q.lastPracticed) {
    const { points, bucket } = questionCompletionPoints(
      q.status,
      practiceDay(q),
      q.lastPracticed,
      now
    );
    return { points, bucket, awardedAt: new Date(q.lastPracticed) };
  }

  return { points: 0, bucket: "zero" };
}

export type MemberGamificationStat = {
  userId: string;
  name: string;
  totalPoints: number;
  perfect: number;
  good: number;
  zero: number;
  pending: number;
  dailyPoints: { date: string; points: number }[];
};

export type GroupGamification = {
  leaderboard: MemberGamificationStat[];
  dailyPoints: { date: string; label: string; points: number }[];
};

function practiceDay(q: { practiceDate?: Date | string; createdAt?: Date | string }): Date {
  return startOfDay(new Date(q.practiceDate ?? q.createdAt ?? new Date()));
}

export function buildMemberGamification(
  userId: string,
  name: string,
  questions: QuestionGamificationInput[],
  days = 7,
  now = new Date()
): MemberGamificationStat {
  let totalPoints = 0;
  let perfect = 0;
  let good = 0;
  let zero = 0;
  let pending = 0;
  const dailyMap = new Map<string, number>();

  for (let i = days - 1; i >= 0; i--) {
    dailyMap.set(istDateKey(addIstDays(now, -i)), 0);
  }

  for (const q of questions) {
    const { points, bucket, awardedAt } = resolveAwardedPoints(q, now);
    totalPoints += points;
    if (bucket === "perfect") perfect++;
    else if (bucket === "good") good++;
    else if (bucket === "zero") zero++;
    else pending++;

    if (points > 0 && awardedAt) {
      const key = istDateKey(awardedAt);
      if (dailyMap.has(key)) {
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + points);
      }
    }
  }

  const dailyPoints = Array.from(dailyMap.entries()).map(([date, points]) => ({ date, points }));

  return {
    userId,
    name,
    totalPoints,
    perfect,
    good,
    zero,
    pending,
    dailyPoints,
  };
}

export function buildGroupGamification(
  members: MemberGamificationStat[],
  days = 7,
  now = new Date()
): GroupGamification {
  const dailyMap = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    dailyMap.set(istDateKey(addIstDays(now, -i)), 0);
  }

  for (const member of members) {
    for (const day of member.dailyPoints) {
      if (dailyMap.has(day.date)) {
        dailyMap.set(day.date, (dailyMap.get(day.date) ?? 0) + day.points);
      }
    }
  }

  const dailyPoints = Array.from(dailyMap.entries()).map(([date, points]) => ({
    date,
    label: new Date(`${date}T00:00:00+05:30`).toLocaleDateString("en-IN", {
      weekday: "short",
      timeZone: "Asia/Kolkata",
    }),
    points,
  }));

  const leaderboard = [...members].sort((a, b) => b.totalPoints - a.totalPoints);

  return {
    leaderboard,
    dailyPoints,
  };
}
