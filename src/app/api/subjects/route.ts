import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError } from "@/lib/utils";
import { serializeDoc } from "@/lib/services";
import {
  buildGroupDoneQuestionStats,
  buildQuestionStats,
  toQuestionsByDate,
} from "@/lib/question-stats";
import Subject from "@/models/Subject";
import Group from "@/models/Group";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import type { ContentScope, SubjectWithStats } from "@/types";

function questionCompletionPercent(questionCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.min(100, Math.round((questionCount / totalQuestions) * 100));
}

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const scope = searchParams.get("scope") as ContentScope | "all" | null;
    const minimal = searchParams.get("minimal") === "1";

    const subjectFilter: Record<string, unknown>[] = [];
    if (groupId && (!scope || scope === "all" || scope === "group")) {
      subjectFilter.push({ groupId, scope: "group", isActive: true });
    }
    if (!scope || scope === "all" || scope === "personal") {
      subjectFilter.push({ userId, scope: "personal", isActive: true });
    }

    if (subjectFilter.length === 0) {
      return jsonError("groupId is required for group subjects");
    }

    const filter =
      subjectFilter.length === 1 ? subjectFilter[0] : { $or: subjectFilter };

    if (minimal) {
      const subjects = await Subject.find(filter).sort({ order: 1 }).lean();
      return jsonOk(subjects.map(serializeDoc));
    }

    const [subjects, group, groupQuestions, personalQuestions] = await Promise.all([
      Subject.find(filter).sort({ order: 1 }).lean(),
      groupId ? Group.findById(groupId).lean() : Promise.resolve(null),
      groupId
        ? PracticeQuestion.find({ groupId, scope: "group" })
            .select("_id subjectId practiceDate createdAt")
            .lean()
        : Promise.resolve([]),
      PracticeQuestion.find({ userId, scope: "personal" })
        .select("subjectId practiceDate createdAt")
        .lean(),
    ]);

    const memberIds = (group?.members ?? []).map((m) => String(m.userId));
    const questionProgress =
      groupId && groupQuestions.length > 0 && memberIds.length > 0
        ? await QuestionProgress.find({
            userId: { $in: memberIds },
            questionId: { $in: groupQuestions.map((q) => q._id) },
          }).lean()
        : [];

    const groupAddedStats = buildQuestionStats(groupQuestions);
    const groupDoneStats = buildGroupDoneQuestionStats(
      groupQuestions,
      memberIds,
      questionProgress
    );
    const personalStats = buildQuestionStats(personalQuestions);

    const stats = subjects.map((s) => {
      const sid = String(s._id);
      const qStats =
        s.scope === "personal" ? personalStats.get(sid) : groupDoneStats.get(sid);
      const questionCount = qStats?.count ?? 0;
      const addedStats = s.scope === "group" ? groupAddedStats.get(sid) : qStats;
      const questionsByDate = addedStats ? toQuestionsByDate(addedStats.byDate) : [];
      const totalQuestions = s.totalQuestions ?? 0;

      return {
        ...serializeDoc(s),
        topicCount: 0,
        completedTopics: 0,
        completionPercent: questionCompletionPercent(questionCount, totalQuestions),
        confidence:
          questionCount === 0
            ? ("weak" as const)
            : questionCompletionPercent(questionCount, totalQuestions) < 40
              ? ("weak" as const)
              : questionCompletionPercent(questionCount, totalQuestions) < 75
                ? ("okay" as const)
                : ("strong" as const),
        studyMinutes: 0,
        questionCount,
        questionsByDate,
        totalQuestions,
      };
    });

    return jsonOk(stats as unknown as SubjectWithStats[]);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to fetch subjects", 500);
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const body = await request.json();
    const {
      groupId,
      name,
      priority,
      description,
      scope = "group",
      totalQuestions,
      contentUnit,
      useForMockInterview,
    } = body;

    if (!name?.trim()) return jsonError("Subject name is required");
    if (scope === "group" && !groupId) return jsonError("groupId is required for group subjects");
    if (scope !== "group" && scope !== "personal") {
      return jsonError("scope must be group or personal");
    }

    const countFilter =
      scope === "group"
        ? { groupId, scope: "group" }
        : { userId, scope: "personal" };
    const count = await Subject.countDocuments(countFilter);

    let parsedTotal = 0;
    if (totalQuestions !== undefined) {
      const n = Number(totalQuestions);
      if (!Number.isFinite(n) || n < 0) return jsonError("totalQuestions must be a non-negative number");
      parsedTotal = Math.round(n);
    }

    const validUnits = ["questions", "videos", "chapters", "problems"];
    const parsedUnit =
      contentUnit && validUnits.includes(contentUnit) ? contentUnit : "questions";

    const subject = await Subject.create({
      ...(scope === "group" ? { groupId } : { userId }),
      scope,
      name: name.trim(),
      priority: priority ?? "medium",
      description: description?.trim(),
      order: count,
      totalQuestions: parsedTotal,
      contentUnit: parsedUnit,
      ...(scope === "group"
        ? { useForMockInterview: useForMockInterview !== false }
        : {}),
    });

    return jsonOk(serializeDoc(subject), 201);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to create subject", 500);
  }
}
