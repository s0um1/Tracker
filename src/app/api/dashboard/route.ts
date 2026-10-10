import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError, toDateInputValue } from "@/lib/utils";
import {
  buildGroupDoneQuestionStats,
  countQuestionsOnDay,
  toQuestionsByDate,
} from "@/lib/question-stats";
import {
  serializeDoc,
  getGroupInsights,
  getTodayQuestionsForUser,
} from "@/lib/services";
import { getInterviewCountdown } from "@/lib/readiness";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import PrepTask from "@/models/PrepTask";
import type { DashboardData } from "@/types";

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();

    const user = await User.findById(userId)
      .select("activeGroupId studyStreak lastStudyDate")
      .lean();
    if (!user) return jsonError("User not found", 404);
    if (!user.activeGroupId) return jsonError("No active group", 400);

    const groupId = String(user.activeGroupId);
    const group = await Group.findById(groupId).lean();
    if (!group) {
      await User.findByIdAndUpdate(userId, { $unset: { activeGroupId: 1 } });
      return jsonError("No active group", 400);
    }

    const countdown = getInterviewCountdown(group.interviewDate);
    const memberIds = (group.members ?? []).map((m) => String(m.userId));

    const [
      { memberStats },
      todayQuestions,
      subjects,
      groupQuestions,
      personalQuestions,
      pendingTasks,
    ] = await Promise.all([
      getGroupInsights(groupId, memberIds),
      getTodayQuestionsForUser(userId, groupId),
      Subject.find({ groupId, isActive: true }).lean(),
      PracticeQuestion.find({ groupId, scope: "group" })
        .select("_id subjectId practiceDate createdAt")
        .lean(),
      PracticeQuestion.find({ userId, groupId, scope: "personal" })
        .select("subjectId practiceDate createdAt")
        .lean(),
      PrepTask.find({
        userId,
        groupId,
        status: { $ne: "completed" },
        dueDate: { $exists: true },
      })
        .sort({ dueDate: 1 })
        .limit(5)
        .lean(),
    ]);

    const readiness = memberStats.find((m) => m.userId === userId)?.readiness ?? 0;

    const questionProgress =
      groupQuestions.length > 0 && memberIds.length > 0
        ? await QuestionProgress.find({
            userId: { $in: memberIds },
            questionId: { $in: groupQuestions.map((q) => q._id) },
          }).lean()
        : [];

    const todayStr = toDateInputValue(new Date());
    const questionsToday =
      countQuestionsOnDay(groupQuestions, todayStr) +
      countQuestionsOnDay(personalQuestions, todayStr);
    const groupQuestionStats = buildGroupDoneQuestionStats(
      groupQuestions,
      memberIds,
      questionProgress
    );
    const subjectStats = subjects.map((s) => {
      const qStats = groupQuestionStats.get(String(s._id));
      const questionCount = qStats?.count ?? 0;
      const totalQuestions = s.totalQuestions ?? 0;
      const completionPercent =
        totalQuestions > 0
          ? Math.min(100, Math.round((questionCount / totalQuestions) * 100))
          : 0;
      return {
        ...serializeDoc(s),
        totalQuestions,
        topicCount: 0,
        completedTopics: 0,
        completionPercent,
        confidence:
          completionPercent < 40
            ? ("weak" as const)
            : completionPercent < 75
              ? ("okay" as const)
              : ("strong" as const),
        studyMinutes: 0,
        questionCount,
        questionsByDate: qStats ? toQuestionsByDate(qStats.byDate) : [],
      };
    });

    const weakSubjects = subjectStats
      .filter((s) => s.totalQuestions > 0 && s.completionPercent < 60)
      .sort((a, b) => a.completionPercent - b.completionPercent)
      .slice(0, 3);

    const groupReadiness =
      memberStats.length > 0
        ? Math.round(memberStats.reduce((s, m) => s + m.readiness, 0) / memberStats.length)
        : 0;

    const data: DashboardData = {
      countdown: {
        ...countdown,
        interviewDate: group.interviewDate?.toISOString() ?? null,
      },
      readiness,
      todayQuestions,
      weakSubjects: weakSubjects as unknown as DashboardData["weakSubjects"],
      groupReadiness,
      memberStats,
      upcomingDeadlines: pendingTasks.map((t) => ({
        label: t.title,
        date: t.dueDate!.toISOString(),
        priority: t.priority,
      })),
      studyStreak: user.studyStreak ?? 0,
      questionsToday,
    };

    return jsonOk(data);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to fetch dashboard", 500);
  }
}
