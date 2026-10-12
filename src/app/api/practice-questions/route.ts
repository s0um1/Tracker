import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import {
  jsonOk,
  jsonError,
  parseDateInput,
  addIstDays,
  startOfDay,
  formatSubjectTrack,
  normalizeQuestionStatus,
  questionDatePeriodRange,
  practiceQuestionScheduledInPeriod,
  compareQuestions,
  DEFAULT_QUESTION_TABLE_SORT,
  type QuestionDatePeriod,
  type QuestionSortField,
  type QuestionSortDir,
  resolveQuestionBody,
  escapeRegex,
  questionMatchesSearch,
} from "@/lib/utils";
import {
  serializeDoc,
  seedQuestionProgressForMembers,
  isGroupMember,
  canManageGroup,
  invalidateGroupInsights,
} from "@/lib/services";
import mongoose from "mongoose";
import { questionProgressFields } from "@/lib/question-progress";
import { NATIVE_PERSONAL_QUESTION_FILTER } from "@/lib/practice-question-filters";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import Group from "@/models/Group";
import type { ContentScope, ContentUnit } from "@/types";

function dayRange(dateStr: string) {
  const start = parseDateInput(dateStr);
  return { start, end: addIstDays(start, 1) };
}

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get("groupId");
    const subjectId = searchParams.get("subjectId");
    const topicId = searchParams.get("topicId");
    const date = searchParams.get("date");
    const period = searchParams.get("period") as QuestionDatePeriod | null;
    const scope = searchParams.get("scope") as ContentScope | "all" | null;

    if (!groupId) return jsonError("groupId is required");

    const group = await Group.findById(groupId).lean();
    if (!group || !isGroupMember(group, userId)) {
      return jsonError("Not a member of this group", 403);
    }

    const filters: Record<string, unknown>[] = [];
    if (!scope || scope === "all" || scope === "group") {
      filters.push({ groupId, scope: "group" });
    }
    if (!scope || scope === "all" || scope === "personal") {
      filters.push({
        groupId,
        userId,
        scope: "personal",
        ...NATIVE_PERSONAL_QUESTION_FILTER,
      });
    }

    const questionFilter: Record<string, unknown> =
      filters.length === 1 ? filters[0] : { $or: filters };
    if (subjectId) questionFilter.subjectId = subjectId;
    if (topicId) questionFilter.topicId = topicId;

    const periodRange =
      period && period !== "all" ? questionDatePeriodRange(period) : date ? dayRange(date) : null;

    if (periodRange) {
      const { start, end } = periodRange;
      questionFilter.$and = [
        ...(Array.isArray(questionFilter.$and) ? questionFilter.$and : []),
        practiceQuestionScheduledInPeriod(start, end),
      ];
    }

    const pageParam = searchParams.get("page");
    const limitParam = searchParams.get("limit");
    const paginate = pageParam !== null || limitParam !== null;
    const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(limitParam ?? "20", 10) || 20));
    const skip = (page - 1) * limit;

    const sortByParam = searchParams.get("sortBy");
    const sortBy: QuestionSortField =
      sortByParam === "status" ||
      sortByParam === "track" ||
      sortByParam === "date" ||
      sortByParam === "scope"
        ? sortByParam
        : DEFAULT_QUESTION_TABLE_SORT.sortBy;
    const sortDirParam = searchParams.get("sortDir");
    const sortDir: QuestionSortDir =
      sortDirParam === "asc" || sortDirParam === "desc"
        ? sortDirParam
        : DEFAULT_QUESTION_TABLE_SORT.sortDir;
    const searchTerm = searchParams.get("search")?.trim() ?? "";

    const subjects = await Subject.find({
      $or: [
        { groupId, scope: "group", isActive: true },
        { userId, scope: "personal", isActive: true },
      ],
    }).lean();

    const activeSubjectIds = subjects.map((s) => s._id);
    if (activeSubjectIds.length === 0) {
      if (paginate) {
        return jsonOk({ items: [], total: 0, page, limit });
      }
      return jsonOk([]);
    }
    questionFilter.$and = [
      ...(Array.isArray(questionFilter.$and) ? questionFilter.$and : []),
      { subjectId: { $in: activeSubjectIds } },
    ];

    if (searchTerm) {
      const regex = new RegExp(escapeRegex(searchTerm), "i");
      const matchingSubjectIds = subjects
        .filter((s) => regex.test(s.name))
        .map((s) => s._id);
      const searchOr: Record<string, unknown>[] = [{ content: regex }];
      if (matchingSubjectIds.length > 0) {
        searchOr.push({ subjectId: { $in: matchingSubjectIds } });
      }
      questionFilter.$and = [
        ...(Array.isArray(questionFilter.$and) ? questionFilter.$and : []),
        { $or: searchOr },
      ];
    }

    const mapQuestion = (
      q: {
      _id: unknown;
      scope: string;
      subjectId: unknown;
      practiceDate?: Date;
      createdAt: Date;
      status?: string;
      confidence?: string;
      lastPracticed?: Date;
      notes?: string;
      },
      subjectMap: Map<string, { name: string; totalQuestions?: number; contentUnit?: ContentUnit }>,
      progressMap: Map<string, { status?: string; confidence?: string; lastPracticed?: Date; notes?: string }>
    ) => {
      const base = serializeDoc(q);
      const practiceDate = q.practiceDate?.toISOString();
      const subject = subjectMap.get(String(q.subjectId));
      const trackLabel = subject
        ? formatSubjectTrack({
            name: subject.name,
            totalQuestions: subject.totalQuestions ?? 0,
            contentUnit: subject.contentUnit ?? "questions",
          })
        : "";
      const p = progressMap.get(String(q._id));
      const fields = questionProgressFields(p, q);
      return {
        ...base,
        practiceDate,
        subjectName: subject?.name ?? "",
        trackLabel,
        ...fields,
      };
    };

    async function progressForQuestions(questions: { _id: unknown }[]) {
      const ids = questions.map((q) => q._id as mongoose.Types.ObjectId);
      if (ids.length === 0) return new Map();
      const progressRows = await QuestionProgress.find({
        userId,
        questionId: { $in: ids },
      }).lean();
      return new Map(progressRows.map((p) => [String(p.questionId), p]));
    }

    const questionFields =
      "_id scope subjectId topicId practiceDate createdAt status confidence lastPracticed notes content link difficulty userId groupId";

    const questions = await PracticeQuestion.find(questionFilter).select(questionFields).lean();
    const subjectMap = new Map(subjects.map((s) => [String(s._id), s]));
    const progressMap = await progressForQuestions(questions);
    let result = questions
      .map((q) => mapQuestion(q, subjectMap, progressMap))
      .sort((a, b) => compareQuestions(a, b, sortBy, sortDir));
    if (searchTerm) {
      result = result.filter((q) =>
        questionMatchesSearch(
          {
            content: String((q as { content?: string }).content ?? ""),
            trackLabel: q.trackLabel,
            subjectName: q.subjectName,
          },
          searchTerm
        )
      );
    }
    const total = result.length;
    if (paginate) result = result.slice(skip, skip + limit);

    if (paginate) {
      return jsonOk({ items: result, total, page, limit });
    }
    return jsonOk(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to fetch questions", 500);
  }
}

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const body = await request.json();
    const {
      groupId,
      subjectId,
      topicId,
      content,
      link,
      difficulty,
      scope = "group",
      practiceDate,
    } = body;

    if (!groupId || !subjectId) {
      return jsonError("groupId and subjectId are required");
    }
    const resolved = resolveQuestionBody({ content, title: body.title, description: body.description });
    if ("error" in resolved) return jsonError(resolved.error);
    const questionContent = resolved.content;
    if (scope !== "group" && scope !== "personal") {
      return jsonError("scope must be group or personal");
    }

    const group = await Group.findById(groupId).lean();
    const role = group ? isGroupMember(group, userId) : null;
    if (!group || !role) {
      return jsonError("Not a member of this group", 403);
    }
    if (scope === "group" && !canManageGroup(role)) {
      return jsonError("Only admins and co-admins can add group questions", 403);
    }

    const subject = await Subject.findById(subjectId).lean();
    if (!subject || !subject.isActive) return jsonError("Subject not found", 404);
    if (scope === "group" && subject.scope !== "group") {
      return jsonError("Group questions must use a group subject");
    }
    if (scope === "personal") {
      if (subject.scope !== "personal") {
        return jsonError("Personal questions must use a personal subject");
      }
      if (String(subject.userId) !== userId) {
        return jsonError("Subject does not belong to you");
      }
    }

    if (topicId) {
      const topic = await Topic.findById(topicId).lean();
      if (!topic || String(topic.subjectId) !== subjectId) {
        return jsonError("Topic does not belong to this subject");
      }
    }

    const parsedPracticeDate = practiceDate ? parseDateInput(practiceDate) : undefined;

    const question = await PracticeQuestion.create({
      userId,
      groupId,
      scope,
      subjectId,
      topicId: topicId || undefined,
      ...(parsedPracticeDate ? { practiceDate: parsedPracticeDate } : {}),
      content: questionContent,
      link: link?.trim(),
      difficulty: difficulty ?? "medium",
    });

    if (scope === "group") {
      await seedQuestionProgressForMembers(String(question._id), groupId);
    } else {
      await QuestionProgress.findOneAndUpdate(
        { userId, questionId: question._id },
        { status: "not_started", confidence: "weak" },
        { upsert: true }
      );
    }
    invalidateGroupInsights(groupId);

    return jsonOk(serializeDoc(question), 201);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to create question", 500);
  }
}
