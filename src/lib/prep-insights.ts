import Subject from "@/models/Subject";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import Group from "@/models/Group";
import User from "@/models/User";
import { getInterviewCountdown } from "@/lib/readiness";
import { getTodayQuestionsForUser } from "@/lib/services";
import { NATIVE_PERSONAL_QUESTION_FILTER } from "@/lib/practice-question-filters";
import { buildDailyPlan, planModeCopy } from "@/lib/daily-plan";
import { normalizeQuestionStatus } from "@/lib/utils";
import { isQuestionDone } from "@/lib/analytics-questions";

const CONFIDENCE_VALUE = { weak: 0.35, okay: 0.7, strong: 1 } as const;

export type SubjectMastery = {
  subjectId: string;
  name: string;
  total: number;
  done: number;
  /** 0-100: completed questions weighted by confidence, over all questions in the subject. */
  mastery: number;
};

export async function getPrepInsights(
  userId: string,
  groupId: string,
  { includePersonal = true }: { includePersonal?: boolean } = {}
) {
  const [user, group, subjects, questions, today] = await Promise.all([
    User.findById(userId).select("dailyStudyMinutes").lean(),
    Group.findById(groupId).select("interviewDate").lean(),
    Subject.find({
      $or: [
        { groupId, scope: "group", isActive: true },
        ...(includePersonal ? [{ userId, scope: "personal", isActive: true }] : []),
      ],
    })
      .select("_id name")
      .lean(),
    PracticeQuestion.find({
      groupId,
      $and: [
        {
          $or: [
            { scope: "group" },
            ...(includePersonal
              ? [{ scope: "personal", userId, ...NATIVE_PERSONAL_QUESTION_FILTER }]
              : []),
          ],
        },
      ],
    })
      .select("_id subjectId content link")
      .lean(),
    getTodayQuestionsForUser(userId, groupId),
  ]);

  const progress = await QuestionProgress.find({
    userId,
    questionId: { $in: questions.map((q) => q._id) },
  }).lean();
  const progressById = new Map(progress.map((p) => [String(p.questionId), p]));

  const stats = new Map<string, { total: number; done: number; score: number }>();
  for (const s of subjects) stats.set(String(s._id), { total: 0, done: 0, score: 0 });

  for (const q of questions) {
    const st = stats.get(String(q.subjectId));
    if (!st) continue;
    const p = progressById.get(String(q._id));
    const status = normalizeQuestionStatus(p?.status ?? "not_started");
    st.total += 1;
    const completed = isQuestionDone(status);
    if (completed) {
      st.done += 1;
      st.score += CONFIDENCE_VALUE[p?.confidence ?? "weak"];
    }
  }

  const subjectMastery: SubjectMastery[] = subjects
    .map((s) => {
      const st = stats.get(String(s._id))!;
      return {
        subjectId: String(s._id),
        name: s.name,
        total: st.total,
        done: st.done,
        mastery: st.total > 0 ? Math.round((st.score / st.total) * 100) : 0,
      };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => a.mastery - b.mastery);

  const countdown = getInterviewCountdown(group?.interviewDate);
  const pendingToday = [...today.group, ...today.personal].filter(
    (q) => !isQuestionDone(q.status)
  ).length;

  const plan = buildDailyPlan({
    daysLeft: countdown.hasDate ? countdown.days : null,
    isPast: countdown.isPast,
    availableMinutes: user?.dailyStudyMinutes ?? 120,
    weakSubjects: subjectMastery.map((s) => ({ name: s.name, mastery: s.mastery })),
    pendingTodayQuestions: pendingToday,
  });

  return {
    daysLeft: countdown.hasDate ? countdown.days : null,
    interviewDate: group?.interviewDate ? new Date(group.interviewDate).toISOString() : null,
    subjects: subjectMastery,
    plan: { ...plan, summary: planModeCopy(plan.mode) },
  };
}

export type PrepInsights = Awaited<ReturnType<typeof getPrepInsights>>;
