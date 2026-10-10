import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError, istDateKey, addIstDays, startOfDay, normalizeQuestionStatus } from "@/lib/utils";
import {
  activityByDay,
  countQuestionsByStatus,
  isQuestionDone,
  trackProgress,
} from "@/lib/analytics-questions";
import { buildMemberGamification } from "@/lib/question-gamification";
import { getGroupInsights } from "@/lib/services";
import { analyticsCacheKey, getCached } from "@/lib/ttl-cache";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import TopicProgress from "@/models/TopicProgress";
import MockInterview from "@/models/MockInterview";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import PrepTask from "@/models/PrepTask";
import StudySession from "@/models/StudySession";
import type { AnalyticsData } from "@/types";
import mongoose from "mongoose";

const ANALYTICS_TTL_MS = 20_000;

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();

    const user = await User.findById(userId)
      .select("activeGroupId studyStreak name")
      .lean();
    if (!user?.activeGroupId) return jsonError("No active group", 400);

    const groupId = String(user.activeGroupId);

    const data = await getCached(analyticsCacheKey(userId, groupId), ANALYTICS_TTL_MS, () =>
      buildAnalytics(userId, groupId, user.name ?? "You", user.studyStreak ?? 0)
    );

    return jsonOk(data);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to fetch analytics", 500);
  }
}

async function buildAnalytics(
  userId: string,
  groupId: string,
  userName: string,
  studyStreak: number
): Promise<AnalyticsData> {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const weekAgo = startOfDay(addIstDays(new Date(), -6));

  const [subjects, topics, mocks, group, personalQuestions, groupQuestions, taskStats, studyMinutesAgg] =
    await Promise.all([
      Subject.find({ groupId }).select("name").lean(),
      Topic.find({ groupId }).select("subjectId status").lean(),
      MockInterview.find({ userId, groupId }).select("date score subjectId").lean(),
      Group.findById(groupId).select("members").lean(),
      PracticeQuestion.find({ userId, groupId, scope: "personal" })
        .select("subjectId status lastPracticed firstCompletedAt practiceDate createdAt")
        .lean(),
      PracticeQuestion.find({ groupId, scope: "group" })
        .select("_id subjectId practiceDate createdAt")
        .lean(),
      PrepTask.aggregate<{ _id: string; count: number }>([
        { $match: { userId: userObjectId, groupId: new mongoose.Types.ObjectId(groupId) } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      StudySession.aggregate<{ total: number }>([
        {
          $match: {
            userId: userObjectId,
            completedAt: { $gte: weekAgo },
          },
        },
        { $group: { _id: null, total: { $sum: "$durationMinutes" } } },
      ]),
    ]);

  const memberIds = (group?.members ?? []).map((m) => String(m.userId));
  const roleMap = new Map(
    (group?.members ?? []).map((m) => [String(m.userId), m.role as "owner" | "admin" | "member"])
  );

  const groupQuestionIds = groupQuestions.map((q) => q._id);
  const topicIds = topics.map((t) => t._id);

  const [questionProgress, topicProgress, insights] = await Promise.all([
    groupQuestionIds.length > 0
      ? QuestionProgress.find({
          userId,
          questionId: { $in: groupQuestionIds },
        })
          .select("questionId status lastPracticed firstCompletedAt pointsAwarded")
          .lean()
      : Promise.resolve([]),
    topicIds.length > 0
      ? TopicProgress.find({ userId, topicId: { $in: topicIds } })
          .select("topicId status")
          .lean()
      : Promise.resolve([]),
    getGroupInsights(groupId, memberIds, roleMap),
  ]);

  const progressByQuestion = new Map(
    questionProgress.map((p) => [String(p.questionId), p])
  );
  const subjectNames = new Map(subjects.map((s) => [String(s._id), s.name]));

  const personalWithStatus = personalQuestions.map((q) => ({
    subjectId: q.subjectId,
    status: normalizeQuestionStatus(q.status ?? "not_started"),
    completedAt: q.lastPracticed ?? q.firstCompletedAt,
    practiceDate: q.practiceDate ?? q.createdAt,
  }));

  const groupWithStatus = groupQuestions.map((q) => {
    const p = progressByQuestion.get(String(q._id));
    const status = normalizeQuestionStatus(p?.status ?? "not_started");
    return {
      subjectId: q.subjectId,
      status,
      completedAt: p?.lastPracticed ?? p?.firstCompletedAt,
      practiceDate: q.practiceDate ?? q.createdAt,
    };
  });

  const personalDone = personalWithStatus.filter((q) => isQuestionDone(q.status)).length;
  const groupDone = groupWithStatus.filter((q) => isQuestionDone(q.status)).length;

  const groupGamificationInput = groupQuestions.map((q) => {
    const p = progressByQuestion.get(String(q._id));
    return {
      _id: String(q._id),
      practiceDate: q.practiceDate ?? q.createdAt,
      createdAt: q.createdAt,
      status: normalizeQuestionStatus(p?.status ?? "not_started"),
      lastPracticed: p?.lastPracticed,
      firstCompletedAt: p?.firstCompletedAt,
      pointsAwarded: p?.pointsAwarded,
    };
  });
  const myGamification = buildMemberGamification(userId, userName, groupGamificationInput, 14);

  const tasksCompleted = taskStats.find((t) => t._id === "completed")?.count ?? 0;
  const tasksTotal = taskStats.reduce((s, t) => s + t.count, 0);
  const studyMinutesWeek = studyMinutesAgg[0]?.total ?? 0;

  const progressMap = new Map(topicProgress.map((p) => [String(p.topicId), p]));

  const subjectCompletion = subjects.map((s) => {
    const subjectTopics = topics.filter((t) => String(t.subjectId) === String(s._id));
    const completed = subjectTopics.filter((t) => {
      const p = progressMap.get(String(t._id));
      const status = p?.status ?? t.status;
      return status === "revised" || status === "interview_ready";
    }).length;
    return {
      name: s.name,
      percent: subjectTopics.length > 0 ? Math.round((completed / subjectTopics.length) * 100) : 0,
    };
  });

  const statusCounts: Record<string, number> = {};
  for (const t of topics) {
    const p = progressMap.get(String(t._id));
    const status = p?.status ?? t.status;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;
  }

  const topicStatusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count,
  }));

  const mockInterviewScores = mocks.map((m) => ({
    date: istDateKey(m.date),
    score: m.score,
    subject: subjects.find((s) => String(s._id) === String(m.subjectId))?.name ?? "General",
  }));

  const { memberStats, gamification } = insights;
  const myReadiness = memberStats.find((m) => m.userId === userId)?.readiness ?? 0;
  const avgReadiness =
    memberStats.length > 0
      ? Math.round(memberStats.reduce((s, m) => s + m.readiness, 0) / memberStats.length)
      : 0;

  return {
    subjectCompletion,
    topicStatusBreakdown,
    mockInterviewScores,
    groupStats: {
      avgReadiness,
      weakSubjects: subjectCompletion.filter((s) => s.percent < 50).map((s) => s.name),
    },
    personal: {
      summary: {
        totalQuestions: personalQuestions.length,
        done: personalDone,
        inProgress: personalWithStatus.filter(
          (q) => normalizeQuestionStatus(q.status) === "in_progress"
        ).length,
        studyMinutesWeek,
        tasksCompleted,
        tasksTotal,
        studyStreak,
      },
      byStatus: countQuestionsByStatus(personalWithStatus.map((q) => q.status)),
      byTrack: trackProgress(personalWithStatus, subjectNames),
      activity: activityByDay(personalWithStatus, 14),
    },
    group: {
      summary: {
        totalQuestions: groupQuestions.length,
        yourDone: groupDone,
        yourPoints: myGamification.totalPoints,
        yourReadiness: myReadiness,
        avgReadiness,
        memberCount: memberStats.length,
      },
      byStatus: countQuestionsByStatus(groupWithStatus.map((q) => q.status)),
      byTrack: trackProgress(groupWithStatus, subjectNames),
      activity: activityByDay(groupWithStatus, 14),
      pointsTrend: myGamification.dailyPoints.map((d) => ({
        date: d.date,
        label: new Date(`${d.date}T00:00:00+05:30`).toLocaleDateString("en-IN", {
          weekday: "short",
          timeZone: "Asia/Kolkata",
        }),
        count: d.points,
      })),
      leaderboard: gamification.leaderboard.slice(0, 8).map((m) => ({
        name: m.name,
        points: m.totalPoints,
        userId: m.userId,
      })),
      memberReadiness: memberStats
        .map((m) => ({ name: m.name, readiness: m.readiness, userId: m.userId }))
        .sort((a, b) => b.readiness - a.readiness),
    },
  };
}
