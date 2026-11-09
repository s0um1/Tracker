import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError, istDateKey } from "@/lib/utils";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import TopicProgress from "@/models/TopicProgress";
import PrepTask from "@/models/PrepTask";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import MockInterview from "@/models/MockInterview";
import StudySession from "@/models/StudySession";
import { getPrepInsights } from "@/lib/prep-insights";
import { getInterviewCountdown } from "@/lib/readiness";

const DAY = 86_400_000;
const RUBRIC_KEYS = ["communication", "correctness", "depth", "confidence"] as const;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const viewerId = requireAuthUserId(request);
    const { id: targetId } = await params;
    await connectToDatabase();

    const target = await User.findById(targetId).lean();
    if (!target) return jsonError("User not found", 404);

    const viewerGroups = await Group.find({
      "members.userId": viewerId,
    }).lean();
    const sharedGroups = viewerGroups.filter((g) =>
      g.members.some((m) => String(m.userId) === targetId)
    );

    const isSelf = viewerId === targetId;
    if (!isSelf && sharedGroups.length === 0) {
      return jsonError("You can only view profiles of group members", 403);
    }

    const primaryGroupId = target.activeGroupId
      ? String(target.activeGroupId)
      : sharedGroups[0] ? String(sharedGroups[0]._id) : null;

    let tasksCompleted = 0;
    let tasksTotal = 0;
    let weakSubjects: string[] = [];
    let strongSubjects: string[] = [];
    let joinedAt: string | undefined;
    let role: string | undefined;
    let stats: {
      questionsDone: number;
      questionsTotal: number;
      points: number;
      doneLast7Days: number;
      daysSinceActive: number | null;
      studyMinutesWeek: number;
      studyMinutesTotal: number;
      heat: Record<string, number>;
    } | null = null;
    let subjects: { name: string; mastery: number; done: number; total: number }[] = [];
    let mock: {
      count: number;
      avgScore: number | null;
      last: { date: string; score: number }[];
      rubric: Record<string, number | null>;
    } | null = null;
    let interview: { date: string; daysLeft: number } | null = null;

    if (primaryGroupId) {
      // Independent lookups run together; tasks are counted by the database instead of loaded.
      const [group, taskCount, completedTaskCount, groupSubjects, topics] = await Promise.all([
        Group.findById(primaryGroupId).lean(),
        PrepTask.countDocuments({ userId: targetId, groupId: primaryGroupId }),
        PrepTask.countDocuments({ userId: targetId, groupId: primaryGroupId, status: "completed" }),
        Subject.find({ groupId: primaryGroupId }).select("_id name").lean(),
        Topic.find({ groupId: primaryGroupId }).select("_id subjectId confidence").lean(),
      ]);
      const member = group?.members.find((m) => String(m.userId) === targetId);
      joinedAt = member?.joinedAt?.toISOString();
      role = member?.role;
      if (group?.interviewDate) {
        const c = getInterviewCountdown(group.interviewDate);
        interview = { date: new Date(group.interviewDate).toISOString(), daysLeft: c.isPast ? 0 : c.days };
      }
      tasksCompleted = completedTaskCount;
      tasksTotal = taskCount;
      const subjectsForScores = groupSubjects;
      const progress = await TopicProgress.find({
        userId: targetId,
        topicId: { $in: topics.map((t) => t._id) },
      }).lean();
      const progressMap = new Map(progress.map((p) => [String(p.topicId), p]));

      const subjectScores = subjectsForScores.map((s) => {
        const subjectTopics = topics.filter((t) => String(t.subjectId) === String(s._id));
        const weak = subjectTopics.filter((t) => {
          const p = progressMap.get(String(t._id));
          return (p?.confidence ?? t.confidence) === "weak";
        }).length;
        const strong = subjectTopics.filter((t) => {
          const p = progressMap.get(String(t._id));
          return (p?.confidence ?? t.confidence) === "strong";
        }).length;
        return { name: s.name, weak, strong, total: subjectTopics.length };
      });

      weakSubjects = subjectScores
        .filter((s) => s.total > 0 && s.weak / s.total >= 0.4)
        .map((s) => s.name);
      strongSubjects = subjectScores
        .filter((s) => s.total > 0 && s.strong / s.total >= 0.5)
        .map((s) => s.name);
    }

    if (primaryGroupId) {
      const now = Date.now();
      // Other members only see group-wide data; personal tracks and notes stay private.
      const insights = await getPrepInsights(targetId, primaryGroupId, { includePersonal: isSelf });
      subjects = insights.subjects.map((s) => ({
        name: s.name,
        mastery: s.mastery,
        done: s.done,
        total: s.total,
      }));

      const groupQuestionIds = (
        await PracticeQuestion.find({ groupId: primaryGroupId, scope: "group" }).select("_id").lean()
      ).map((q) => q._id);
      const [progress, sessions, interviews] = await Promise.all([
        QuestionProgress.find({
          userId: targetId,
          questionId: { $in: groupQuestionIds },
        })
          .select("status pointsAwarded lastPracticed updatedAt")
          .lean(),
        StudySession.find({ userId: targetId, groupId: primaryGroupId })
          .select("durationMinutes completedAt")
          .lean(),
        MockInterview.find({ userId: targetId, groupId: primaryGroupId }).sort({ date: -1 }).lean(),
      ]);

      const practised = progress.filter((p) => p.status === "done" || p.status === "revised");
      const lastAt = practised.reduce((max, p) => {
        const at = new Date(p.lastPracticed ?? p.updatedAt).getTime();
        return at > max ? at : max;
      }, 0);
      stats = {
        questionsDone: subjects.reduce((n, s) => n + s.done, 0),
        questionsTotal: subjects.reduce((n, s) => n + s.total, 0),
        points: progress.reduce((n, p) => n + (p.pointsAwarded ?? 0), 0),
        doneLast7Days: practised.filter(
          (p) => now - new Date(p.lastPracticed ?? p.updatedAt).getTime() <= 7 * DAY
        ).length,
        daysSinceActive: lastAt ? Math.floor((now - lastAt) / DAY) : null,
        studyMinutesWeek: sessions
          .filter((s) => now - new Date(s.completedAt).getTime() <= 7 * DAY)
          .reduce((n, s) => n + s.durationMinutes, 0),
        studyMinutesTotal: sessions.reduce((n, s) => n + s.durationMinutes, 0),
        heat: practised.reduce<Record<string, number>>((acc, p) => {
          const at = new Date(p.lastPracticed ?? p.updatedAt);
          if (now - at.getTime() <= 371 * DAY) {
            const key = istDateKey(at);
            acc[key] = (acc[key] ?? 0) + 1;
          }
          return acc;
        }, {}),
      };

      const avg = (vals: number[]) =>
        vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
      mock = {
        count: interviews.length,
        avgScore: avg(interviews.map((i) => i.score)),
        last: interviews
          .slice(0, 5)
          .reverse()
          .map((i) => ({ date: new Date(i.date).toISOString(), score: i.score })),
        rubric: Object.fromEntries(
          RUBRIC_KEYS.map((k) => [
            k,
            avg(interviews.map((i) => i.rubric?.[k]).filter((v): v is number => typeof v === "number")),
          ])
        ),
      };
    }

    return jsonOk({
      _id: String(target._id),
      username: target.username,
      name: target.name,
      preparationLevel: target.preparationLevel,
      studyStreak: target.studyStreak,
      dailyStudyMinutes: target.dailyStudyMinutes,
      tasksCompleted,
      tasksTotal,
      sharedGroups: sharedGroups.map((g) => ({ _id: String(g._id), name: g.name })),
      weakSubjects,
      strongSubjects,
      joinedAt,
      role,
      stats,
      subjects,
      mock,
      interview,
      // Personal goals are only shown to the profile owner.
      target: isSelf ? { company: target.targetCompany, role: target.targetRole } : null,
      isSelf,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to load profile", 500);
  }
}
