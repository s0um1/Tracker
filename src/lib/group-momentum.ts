/** Pure calculations behind the group momentum panel. No I/O, so they're easy to test. */

export type ActivityEvent = {
  userId: string;
  at: Date;
  /** A question completed, or a focus session. */
  kind: "question" | "study";
  minutes?: number;
};

export type MemberMomentum = {
  userId: string;
  /** Oldest to newest: was the member active on each of the last 7 days? */
  dots: boolean[];
  activeDays: number;
  doneWeek: number;
  minutesWeek: number;
  daysSinceActive: number | null;
};

export type DayBucket = { key: string; questions: number; activeMembers: number; isToday: boolean };

export type Highlight = { userId: string; value: number };

export type Momentum = {
  members: Record<string, MemberMomentum>;
  days: DayBucket[];
  streak: number;
  doneWeek: number;
  minutesWeek: number;
  activeMembers: number;
  highlights: { topSolver: Highlight | null; mostConsistent: Highlight | null; mostFocused: Highlight | null };
};

const DAY_MS = 86_400_000;
const STREAK_LOOKBACK_DAYS = 60;

export function buildMomentum(opts: {
  memberIds: string[];
  events: ActivityEvent[];
  now: Date;
  /** Calendar-day key for a moment, e.g. "2026-11-03" in the app's timezone. */
  dayKey: (d: Date) => string;
}): Momentum {
  const { memberIds, events, now, dayKey } = opts;
  const todayKey = dayKey(now);
  const dayKeyAgo = (n: number) => dayKey(new Date(now.getTime() - n * DAY_MS));
  const weekKeys = Array.from({ length: 7 }, (_, i) => dayKeyAgo(6 - i));

  const activeOnDay = new Map<string, Set<string>>();
  const questionsOnDay = new Map<string, number>();
  const memberDays = new Map<string, Set<string>>();
  const lastActive = new Map<string, number>();
  const doneWeek = new Map<string, number>();
  const minutesWeek = new Map<string, number>();
  const weekSet = new Set(weekKeys);

  for (const e of events) {
    const key = dayKey(e.at);
    if (!activeOnDay.has(key)) activeOnDay.set(key, new Set());
    activeOnDay.get(key)!.add(e.userId);
    if (!memberDays.has(e.userId)) memberDays.set(e.userId, new Set());
    memberDays.get(e.userId)!.add(key);
    lastActive.set(e.userId, Math.max(lastActive.get(e.userId) ?? 0, e.at.getTime()));
    if (weekSet.has(key)) {
      if (e.kind === "question") {
        questionsOnDay.set(key, (questionsOnDay.get(key) ?? 0) + 1);
        doneWeek.set(e.userId, (doneWeek.get(e.userId) ?? 0) + 1);
      } else {
        minutesWeek.set(e.userId, (minutesWeek.get(e.userId) ?? 0) + (e.minutes ?? 0));
      }
    }
  }

  const members: Record<string, MemberMomentum> = {};
  for (const id of memberIds) {
    const days = memberDays.get(id) ?? new Set<string>();
    const dots = weekKeys.map((k) => days.has(k));
    const last = lastActive.get(id);
    members[id] = {
      userId: id,
      dots,
      activeDays: dots.filter(Boolean).length,
      doneWeek: doneWeek.get(id) ?? 0,
      minutesWeek: minutesWeek.get(id) ?? 0,
      daysSinceActive: last === undefined ? null : Math.max(0, Math.floor((now.getTime() - last) / DAY_MS)),
    };
  }

  const dayBuckets: DayBucket[] = weekKeys.map((key) => ({
    key,
    questions: questionsOnDay.get(key) ?? 0,
    activeMembers: [...(activeOnDay.get(key) ?? [])].filter((id) => memberIds.includes(id)).length,
    isToday: key === todayKey,
  }));

  // Team streak: consecutive days with at least one member active. Today doesn't break it
  // until the day is over, so start from yesterday when nobody has practised yet today.
  const anyoneActive = (key: string) => [...(activeOnDay.get(key) ?? [])].some((id) => memberIds.includes(id));
  let streak = 0;
  for (let i = anyoneActive(todayKey) ? 0 : 1; i < STREAK_LOOKBACK_DAYS; i++) {
    if (!anyoneActive(dayKeyAgo(i))) break;
    streak++;
  }

  const list = Object.values(members);
  const best = (value: (m: MemberMomentum) => number, tie: (m: MemberMomentum) => number): Highlight | null => {
    const top = [...list].sort((a, b) => value(b) - value(a) || tie(b) - tie(a))[0];
    return top && value(top) > 0 ? { userId: top.userId, value: value(top) } : null;
  };

  return {
    members,
    days: dayBuckets,
    streak,
    doneWeek: list.reduce((n, m) => n + m.doneWeek, 0),
    minutesWeek: list.reduce((n, m) => n + m.minutesWeek, 0),
    activeMembers: list.filter((m) => m.activeDays > 0).length,
    highlights: {
      topSolver: best((m) => m.doneWeek, (m) => m.activeDays),
      mostConsistent: best((m) => m.activeDays, (m) => m.doneWeek),
      mostFocused: best((m) => m.minutesWeek, (m) => m.doneWeek),
    },
  };
}

const MILESTONES = [25, 50, 100, 250, 500, 1000, 2000, 5000];

/** The milestone just reached and the next one to aim for. */
export function nextMilestone(total: number): { prev: number; next: number } {
  const next = MILESTONES.find((m) => m > total) ?? Math.ceil((total + 1) / 1000) * 1000;
  const prev = [...MILESTONES].reverse().find((m) => m <= total) ?? 0;
  return { prev, next };
}

export type MemberStatus = "today" | "recent" | "quiet" | "away";

export function memberStatus(daysSinceActive: number | null): MemberStatus {
  if (daysSinceActive === null) return "away";
  if (daysSinceActive === 0) return "today";
  if (daysSinceActive <= 2) return "recent";
  if (daysSinceActive <= 6) return "quiet";
  return "away";
}

/** One-line headline that matches how the week is actually going. */
export function momentumHeadline(m: { streak: number; activeMembers: number; memberCount: number; goalPct: number }) {
  if (m.memberCount > 1 && m.activeMembers === m.memberCount && m.goalPct >= 100)
    return { title: "Goal smashed", detail: "Everyone showed up and the weekly goal is done. Take a bow." };
  if (m.goalPct >= 100) return { title: "Weekly goal reached", detail: "Keep the rhythm going. Consistency beats cramming." };
  if (m.streak >= 7) return { title: `${m.streak}-day team streak`, detail: "A full week of momentum. Protect the streak today." };
  if (m.streak >= 3) return { title: "Team is on a roll", detail: `${m.streak} days in a row. Don't be the one who breaks it.` };
  if (m.streak >= 1) return { title: "Momentum is building", detail: "Another session today keeps the streak growing." };
  if (m.activeMembers === 0) return { title: "Quiet week so far", detail: "One 10-minute session today restarts the streak." };
  return { title: "Let's get moving", detail: "A few questions from each person gets the team back on track." };
}

/** What /api/group-dynamics returns. Shared with the panel so the two stay in sync. */
export type MomentumMember = {
  userId: string;
  name: string;
  role: string;
  isSelf: boolean;
  studyStreak: number;
  /** Group questions this member has completed (done and revised both count as done). */
  questionsDone: number;
  /** questionsDone as a percentage of all group questions. */
  donePercent: number;
  dots: boolean[];
  /** Questions completed per day ("YYYY-MM-DD" -> count), only days with activity. */
  heat: Record<string, number>;
  /** When this member last completed a question (ISO), or null if never. */
  lastSolvedAt: string | null;
  /** When this member was last seen in the app (ISO), or null if unknown. */
  lastOnlineAt: string | null;
  /** Seen in the app within the last couple of minutes. */
  online: boolean;
  activeDays: number;
  doneWeek: number;
  minutesWeek: number;
  daysSinceActive: number | null;
  status: MemberStatus;
  cheersWeek: number;
  /** Note kinds the viewer already sent this person in the last 24 hours. */
  sentToday: string[];
  /** Only filled in for admins. */
  behindReasons: string[];
};

export type MomentumResponse = {
  isAdmin: boolean;
  unreadNotes: number;
  headline: { title: string; detail: string };
  team: {
    memberCount: number;
    activeMembers: number;
    doneWeek: number;
    goal: number;
    minutesWeek: number;
    streak: number;
    /** Questions in the group's shared bank. */
    totalQuestions: number;
    /** Completions across every member, so a question done by 3 people counts 3 times. */
    totalDone: number;
    milestone: { prev: number; next: number };
    days: DayBucket[];
    /** Questions completed per day across the whole group, only days with activity. */
    heat: Record<string, number>;
  };
  highlights: Record<"topSolver" | "mostConsistent" | "mostFocused", (Highlight & { name: string }) | null>;
  members: MomentumMember[];
};
