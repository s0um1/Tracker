export type PlanMode = "steady" | "crunch" | "sprint" | "post";

export type PlanItem = {
  id: string;
  title: string;
  reason: string;
  minutes: number;
  href: string;
};

export type DailyPlanInput = {
  /** Whole days until the interview; null when no date is set. */
  daysLeft: number | null;
  isPast?: boolean;
  availableMinutes: number;
  /** Subjects sorted weakest first. */
  weakSubjects: { name: string; mastery: number }[];
  pendingTodayQuestions: number;
  mockToday?: boolean;
};

export function planModeFor(daysLeft: number | null, isPast = false): PlanMode {
  if (isPast) return "post";
  if (daysLeft === null) return "steady";
  if (daysLeft <= 3) return "sprint";
  if (daysLeft <= 14) return "crunch";
  return "steady";
}

const MODE_COPY: Record<PlanMode, string> = {
  steady: "Steady pace — build coverage and keep your question count moving.",
  crunch: "Crunch time — weak areas and revision come before new material.",
  sprint: "Final sprint — no new topics. Review, mock, and rest.",
  post: "Interview date has passed — set a new date in Settings to re-plan.",
};

export function planModeCopy(mode: PlanMode) {
  return MODE_COPY[mode];
}

/**
 * Builds a time-boxed plan. Priorities shift with the interview date:
 * the closer it is, the more time goes to review and weak areas versus new questions.
 */
export function buildDailyPlan(input: DailyPlanInput): { mode: PlanMode; items: PlanItem[]; totalMinutes: number } {
  const mode = planModeFor(input.daysLeft, input.isPast);
  const budget = Math.max(30, input.availableMinutes);
  const items: PlanItem[] = [];
  let used = 0;
  const add = (item: PlanItem) => {
    if (used + item.minutes > budget && items.length > 0) return;
    items.push(item);
    used += item.minutes;
  };

  if (input.mockToday) {
    add({
      id: "mock",
      title: "Mock interview today",
      reason: "Your group mock is scheduled for today.",
      minutes: 45,
      href: "/groups",
    });
  }

  const weakCount = mode === "sprint" ? 3 : mode === "crunch" ? 2 : 1;
  for (const s of input.weakSubjects.filter((s) => s.mastery < 60).slice(0, weakCount)) {
    add({
      id: `weak-${s.name}`,
      title: `Strengthen ${s.name}`,
      reason: `Only ${s.mastery}% mastered — one of your weakest areas.`,
      minutes: mode === "sprint" ? 20 : 30,
      href: "/questions",
    });
  }

  if (mode !== "sprint" && mode !== "post" && input.pendingTodayQuestions > 0) {
    add({
      id: "today",
      title: `Finish today's ${input.pendingTodayQuestions} scheduled question${input.pendingTodayQuestions === 1 ? "" : "s"}`,
      reason: "Keeps you on the group's pace.",
      minutes: Math.min(60, input.pendingTodayQuestions * 12),
      href: "/questions",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "free",
      title: "You're caught up",
      reason: "Add more questions or run a mock interview.",
      minutes: 0,
      href: "/questions",
    });
  }

  return { mode, items, totalMinutes: used };
}
