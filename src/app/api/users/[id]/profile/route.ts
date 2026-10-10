import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError } from "@/lib/utils";
import { getUserReadiness } from "@/lib/services";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import TopicProgress from "@/models/TopicProgress";
import PrepTask from "@/models/PrepTask";

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

    let readiness = 0;
    let tasksCompleted = 0;
    let tasksTotal = 0;
    let weakSubjects: string[] = [];
    let strongSubjects: string[] = [];
    let joinedAt: string | undefined;

    if (primaryGroupId) {
      const group = await Group.findById(primaryGroupId).lean();
      const member = group?.members.find((m) => String(m.userId) === targetId);
      joinedAt = member?.joinedAt?.toISOString();

      readiness = await getUserReadiness(targetId, primaryGroupId);

      const tasks = await PrepTask.find({ userId: targetId, groupId: primaryGroupId }).lean();
      tasksCompleted = tasks.filter((t) => t.status === "completed").length;
      tasksTotal = tasks.length;

      const subjects = await Subject.find({ groupId: primaryGroupId }).lean();
      const topics = await Topic.find({ groupId: primaryGroupId }).lean();
      const progress = await TopicProgress.find({
        userId: targetId,
        topicId: { $in: topics.map((t) => t._id) },
      }).lean();
      const progressMap = new Map(progress.map((p) => [String(p.topicId), p]));

      const subjectScores = subjects.map((s) => {
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

    return jsonOk({
      _id: String(target._id),
      username: target.username,
      name: target.name,
      preparationLevel: target.preparationLevel,
      studyStreak: target.studyStreak,
      dailyStudyMinutes: target.dailyStudyMinutes,
      readiness,
      tasksCompleted,
      tasksTotal,
      sharedGroups: sharedGroups.map((g) => ({ _id: String(g._id), name: g.name })),
      weakSubjects,
      strongSubjects,
      joinedAt,
      isSelf,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to load profile", 500);
  }
}
