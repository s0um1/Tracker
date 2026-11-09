import mongoose from "mongoose";
import User from "@/models/User";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import Topic from "@/models/Topic";
import TopicProgress from "@/models/TopicProgress";
import QuestionProgress from "@/models/QuestionProgress";
import PracticeQuestion from "@/models/PracticeQuestion";
import PrepTask from "@/models/PrepTask";
import MockInterview from "@/models/MockInterview";
import MockInterviewSession from "@/models/MockInterviewSession";
import MockInterviewSlot from "@/models/MockInterviewSlot";
import MockInterviewRound from "@/models/MockInterviewRound";
import StudySession from "@/models/StudySession";
import PreparationPlan from "@/models/PreparationPlan";
import type { GroupRole } from "@/types";
import { canManageGroup } from "@/lib/group-roles";

export { canManageGroup };
import {
  formatSubjectTrack,
  generateJoinCode,
  joinCodeExpiryDate,
  needsJoinCodeReissue,
  normalizeQuestionStatus,
  questionDatePeriodRange,
  serializeDoc,
  startOfDay,
} from "./utils";
import { questionProgressFields, questionStatusForUser } from "./question-progress";
import { NATIVE_PERSONAL_QUESTION_FILTER } from "./practice-question-filters";
import type { ContentUnit, TodayQuestion } from "@/types";
import {
  buildGroupGamification,
  buildMemberGamification,
  type GroupGamification,
} from "./question-gamification";
import { getCached, groupInsightsCacheKey, invalidateCachePrefix } from "./ttl-cache";

const GROUP_INSIGHTS_TTL_MS = 30_000;

export function invalidateGroupInsights(groupId: string): void {
  invalidateCachePrefix(groupInsightsCacheKey(groupId));
  invalidateCachePrefix("analytics:");
}

type GroupStatsContext = {
  topics: { _id: mongoose.Types.ObjectId; status: string; confidence: string }[];
  users: { _id: mongoose.Types.ObjectId; name?: string; studyStreak?: number }[];
  topicProgress: {
    userId: mongoose.Types.ObjectId;
    topicId: mongoose.Types.ObjectId;
    status?: string;
    confidence?: string;
  }[];
  mocks: { userId: mongoose.Types.ObjectId; score: number }[];
  taskStats: { _id: mongoose.Types.ObjectId; total: number; completed: number }[];
  group: { interviewDate?: Date } | null;
  questions: {
    _id: mongoose.Types.ObjectId;
    practiceDate?: Date;
    createdAt: Date;
  }[];
  questionProgress: {
    userId: mongoose.Types.ObjectId;
    questionId: mongoose.Types.ObjectId;
    status?: string;
    lastPracticed?: Date;
    pointsAwarded?: number;
    firstCompletedAt?: Date;
  }[];
};

async function loadGroupStatsContext(
  groupId: string,
  memberIds: string[]
): Promise<GroupStatsContext | null> {
  if (memberIds.length === 0) return null;

  const objectIds = memberIds.map((id) => new mongoose.Types.ObjectId(id));
  const groupObjectId = new mongoose.Types.ObjectId(groupId);

  const topics = await Topic.find({ groupId }).lean();
  const topicIds = topics.map((t) => t._id);
  const questions = await PracticeQuestion.find({ groupId, scope: "group" }).lean();
  const questionIds = questions.map((q) => q._id);

  const [users, topicProgress, mocks, taskStats, group, questionProgress] = await Promise.all([
    User.find({ _id: { $in: objectIds } }).lean(),
    topicIds.length > 0
      ? TopicProgress.find({ userId: { $in: objectIds }, topicId: { $in: topicIds } }).lean()
      : Promise.resolve([]),
    MockInterview.find({ userId: { $in: objectIds }, groupId }).lean(),
    PrepTask.aggregate<{
      _id: mongoose.Types.ObjectId;
      total: number;
      completed: number;
    }>([
      { $match: { userId: { $in: objectIds }, groupId: groupObjectId } },
      {
        $group: {
          _id: "$userId",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
        },
      },
    ]),
    Group.findById(groupId).lean(),
    questionIds.length > 0
      ? QuestionProgress.find({
          userId: { $in: objectIds },
          questionId: { $in: questionIds },
        }).lean()
      : Promise.resolve([]),
  ]);

  return {
    topics,
    users,
    topicProgress,
    mocks,
    taskStats,
    group,
    questions,
    questionProgress,
  };
}

function memberStatsFromContext(
  memberIds: string[],
  roleMap: Map<string, GroupRole> | undefined,
  ctx: GroupStatsContext
): MemberStat[] {
  const userMap = new Map(ctx.users.map((u) => [String(u._id), u]));
  const taskStatsMap = new Map(ctx.taskStats.map((t) => [String(t._id), t]));

  return memberIds.map((userId) => {
    const user = userMap.get(userId);
    const stats = taskStatsMap.get(userId);

    return {
      userId,
      name: user?.name ?? "Unknown",
      tasksCompleted: stats?.completed ?? 0,
      role: roleMap?.get(userId),
    };
  });
}

function gamificationFromContext(memberIds: string[], ctx: GroupStatsContext): GroupGamification {
  const userMap = new Map(ctx.users.map((u) => [String(u._id), u.name]));
  const progressByUser = new Map<string, Map<string, (typeof ctx.questionProgress)[number]>>();
  for (const p of ctx.questionProgress) {
    const uid = String(p.userId);
    const byQuestion = progressByUser.get(uid) ?? new Map();
    byQuestion.set(String(p.questionId), p);
    progressByUser.set(uid, byQuestion);
  }

  const members = memberIds.map((userId) => {
    const byQuestion = progressByUser.get(userId) ?? new Map();
    const memberQuestions = ctx.questions.map((q) => {
      const p = byQuestion.get(String(q._id));
      return {
        _id: String(q._id),
        practiceDate: q.practiceDate ?? q.createdAt,
        createdAt: q.createdAt,
        status: normalizeQuestionStatus(p?.status ?? "not_started"),
        lastPracticed: p?.lastPracticed,
        pointsAwarded: p?.pointsAwarded,
        firstCompletedAt: p?.firstCompletedAt,
      };
    });
    return buildMemberGamification(userId, userMap.get(userId) ?? "Unknown", memberQuestions);
  });

  return buildGroupGamification(members);
}

export async function seedGroupSubjects(groupId: string, subjectNames: string[]) {
  const created = [];
  for (let i = 0; i < subjectNames.length; i++) {
    const name = subjectNames[i]?.trim();
    if (!name) continue;
    const subject = await Subject.create({
      groupId,
      scope: "group",
      name,
      priority: i < 2 ? "high" : "medium",
      order: i,
    });
    created.push(subject);
  }
  return created;
}

export async function ensureTopicProgress(userId: string, groupId: string) {
  const topics = await Topic.find({ groupId }).lean();
  const existing = await TopicProgress.find({
    userId,
    topicId: { $in: topics.map((t) => t._id) },
  }).lean();
  const existingIds = new Set(existing.map((e) => String(e.topicId)));

  const toCreate = topics
    .filter((t) => !existingIds.has(String(t._id)))
    .map((t) => ({ userId, topicId: t._id }));

  if (toCreate.length > 0) {
    await TopicProgress.insertMany(toCreate);
  }
}

async function ensurePersonalSubjectForGroupSubject(
  userId: string,
  groupSubjectId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId> {
  const groupSubject = await Subject.findById(groupSubjectId).lean();
  if (!groupSubject) throw new Error("Subject not found");

  const existing = await Subject.findOne({
    userId,
    scope: "personal",
    name: groupSubject.name,
    isActive: true,
  }).lean();
  if (existing) return existing._id;

  const count = await Subject.countDocuments({ userId, scope: "personal" });
  const created = await Subject.create({
    userId,
    scope: "personal",
    name: groupSubject.name,
    priority: groupSubject.priority,
    order: count,
  });
  return created._id;
}

function questionTaskTitle(content: string): string {
  const line = content.split("\n")[0];
  const preview = line.length > 80 ? `${line.slice(0, 80)}…` : line;
  return `Practice: ${preview}`;
}

type QuestionTodoSource = {
  _id: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  subjectId: mongoose.Types.ObjectId;
  topicId?: mongoose.Types.ObjectId;
  content: string;
  link?: string;
};

/** The upsert that creates (or refreshes) the to-do task for a question marked "add to todo". */
function todoTaskUpsert(userId: mongoose.Types.ObjectId, question: QuestionTodoSource) {
  return {
    filter: { userId, questionId: question._id },
    update: {
      $setOnInsert: {
        groupId: question.groupId,
        userId,
        questionId: question._id,
        priority: "medium" as const,
        estimatedMinutes: 30,
        status: "pending" as const,
      },
      $set: {
        title: questionTaskTitle(question.content),
        subjectId: question.subjectId,
        topicId: question.topicId,
        description: question.link?.trim() || undefined,
      },
    },
  };
}

export async function syncQuestionTodoTask(
  userId: string,
  question: QuestionTodoSource,
  status: "not_started" | "add_to_todo" | "in_progress" | "revised" | "done"
) {
  const uid = new mongoose.Types.ObjectId(userId);

  if (status === "add_to_todo") {
    const { filter, update } = todoTaskUpsert(uid, question);
    await PrepTask.findOneAndUpdate(filter, update, { upsert: true });
    return;
  }

  await PrepTask.deleteOne({ userId: uid, questionId: question._id });
}

/**
 * Makes sure every "add to todo" question has a task. Runs on each tasks-page load, so it
 * only reads the questions it needs and writes only the tasks that are missing or stale.
 */
export async function ensureQuestionTodoTasks(userId: string, groupId: string) {
  const gid = new mongoose.Types.ObjectId(groupId);
  const uid = new mongoose.Types.ObjectId(userId);

  const [progress, personalQuestions] = await Promise.all([
    QuestionProgress.find({ userId: uid, status: "add_to_todo" }).select("questionId").lean(),
    PracticeQuestion.find({
      userId: uid,
      groupId: gid,
      scope: "personal",
      status: "add_to_todo",
      ...NATIVE_PERSONAL_QUESTION_FILTER,
    })
      .select("_id groupId subjectId topicId content link")
      .lean(),
  ]);

  const groupQuestions =
    progress.length > 0
      ? await PracticeQuestion.find({
          _id: { $in: progress.map((p) => p.questionId) },
          groupId: gid,
          scope: "group",
        })
          .select("_id groupId subjectId topicId content link")
          .lean()
      : [];

  const sources: QuestionTodoSource[] = [...groupQuestions, ...personalQuestions];
  if (sources.length === 0) return;

  const existing = await PrepTask.find({ userId: uid, questionId: { $in: sources.map((q) => q._id) } })
    .select("questionId title subjectId description")
    .lean();
  const existingByQuestion = new Map(existing.map((t) => [String(t.questionId), t]));

  const ops = sources
    .filter((q) => {
      const task = existingByQuestion.get(String(q._id));
      if (!task) return true;
      // Re-sync only when the question changed since the task was created.
      return (
        task.title !== questionTaskTitle(q.content) ||
        String(task.subjectId ?? "") !== String(q.subjectId) ||
        (task.description ?? "") !== (q.link?.trim() ?? "")
      );
    })
    .map((q) => {
      const { filter, update } = todoTaskUpsert(uid, q);
      return { updateOne: { filter, update, upsert: true } };
    });

  if (ops.length > 0) await PrepTask.bulkWrite(ops, { ordered: false });
}

export async function syncGroupProgressToPersonal(
  userId: string,
  groupQuestion: {
    _id: mongoose.Types.ObjectId;
    groupId: mongoose.Types.ObjectId;
    subjectId: mongoose.Types.ObjectId;
    topicId?: mongoose.Types.ObjectId;
    practiceDate?: Date;
    content: string;
    link?: string;
    difficulty: "easy" | "medium" | "hard";
  },
  progress: {
    status: "not_started" | "add_to_todo" | "in_progress" | "revised" | "done";
    confidence: "weak" | "okay" | "strong";
    lastPracticed?: Date;
    notes?: string;
  }
) {
  if (progress.status === "not_started" || progress.status === "add_to_todo") return;

  const personalSubjectId = await ensurePersonalSubjectForGroupSubject(
    userId,
    groupQuestion.subjectId
  );

  await PracticeQuestion.findOneAndUpdate(
    { userId, sourceGroupQuestionId: groupQuestion._id, scope: "personal" },
    {
      $setOnInsert: {
        userId,
        groupId: groupQuestion.groupId,
        scope: "personal",
        sourceGroupQuestionId: groupQuestion._id,
        subjectId: personalSubjectId,
        topicId: groupQuestion.topicId,
        practiceDate: groupQuestion.practiceDate ?? new Date(),
        content: groupQuestion.content,
        link: groupQuestion.link,
        difficulty: groupQuestion.difficulty,
      },
      $set: {
        status: progress.status,
        confidence: progress.confidence,
        lastPracticed: progress.lastPracticed,
        notes: progress.notes,
      },
    },
    { upsert: true }
  );
}

export async function seedQuestionProgressForMembers(questionId: string, groupId: string) {
  const group = await Group.findById(groupId).lean();
  if (!group) return;

  const memberIds = group.members.map((m) => m.userId);
  const existing = await QuestionProgress.find({
    questionId,
    userId: { $in: memberIds },
  }).lean();
  const existingUserIds = new Set(existing.map((e) => String(e.userId)));

  const missing = memberIds.filter((id) => !existingUserIds.has(String(id)));
  if (missing.length === 0) return;

  const qid = new mongoose.Types.ObjectId(questionId);
  await QuestionProgress.bulkWrite(
    missing.map((userId) => ({
      updateOne: {
        filter: { userId, questionId: qid },
        update: {
          $setOnInsert: {
            userId,
            questionId: qid,
            status: "not_started",
            confidence: "weak",
          },
        },
        upsert: true,
      },
    }))
  );
}

export function isGroupMember(
  group: { members?: { userId: mongoose.Types.ObjectId; role: GroupRole }[] },
  userId: string
): GroupRole | null {
  const member = (group.members ?? []).find((m) => String(m.userId) === userId);
  return member?.role ?? null;
}

export async function issueJoinCode(
  group: InstanceType<typeof Group>,
  excludeId?: string
): Promise<{ joinCode: string; joinCodeExpiresAt: Date }> {
  let joinCode = generateJoinCode();
  while (await Group.findOne({ joinCode, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })) {
    joinCode = generateJoinCode();
  }
  group.joinCode = joinCode;
  group.joinCodeExpiresAt = joinCodeExpiryDate();
  await group.save();
  return { joinCode, joinCodeExpiresAt: group.joinCodeExpiresAt };
}

export async function ensureFreshJoinCodeForOwner(
  groupId: string,
  userId: string
): Promise<InstanceType<typeof Group> | null> {
  const group = await Group.findById(groupId);
  if (!group) return null;
  if (!canManageGroup(isGroupMember(group, userId))) return group;
  if (!needsJoinCodeReissue(group.joinCode, group.joinCodeExpiresAt)) return group;
  await issueJoinCode(group, groupId);
  return group;
}

/** ponytail: deletes group-scoped data; upgrade path is soft-delete + archive if retention needed */
export async function deleteGroupData(groupId: string) {
  const gid = new mongoose.Types.ObjectId(groupId);
  const [questionIds, topicIds] = await Promise.all([
    PracticeQuestion.find({ groupId: gid }).distinct("_id"),
    Topic.find({ groupId: gid }).distinct("_id"),
  ]);

  await Promise.all([
    PracticeQuestion.deleteMany({ groupId: gid }),
    questionIds.length > 0
      ? QuestionProgress.deleteMany({ questionId: { $in: questionIds } })
      : Promise.resolve(),
    Subject.deleteMany({ groupId: gid }),
    Topic.deleteMany({ groupId: gid }),
    topicIds.length > 0
      ? TopicProgress.deleteMany({ topicId: { $in: topicIds } })
      : Promise.resolve(),
    PrepTask.deleteMany({ groupId: gid }),
    MockInterview.deleteMany({ groupId: gid }),
    MockInterviewSession.deleteMany({ groupId: gid }),
    MockInterviewSlot.deleteMany({ groupId: gid }),
    MockInterviewRound.deleteMany({ groupId: gid }),
    StudySession.deleteMany({ groupId: gid }),
    PreparationPlan.deleteMany({ groupId: gid }),
  ]);
}

/** Removes a track and its questions, topics, tasks, and related progress. */
export async function deleteSubjectData(subjectId: string) {
  const sid = new mongoose.Types.ObjectId(subjectId);
  const [questionIds, topicIds] = await Promise.all([
    PracticeQuestion.find({ subjectId: sid }).distinct("_id"),
    Topic.find({ subjectId: sid }).distinct("_id"),
  ]);

  await PracticeQuestion.deleteMany({
    $or: [
      { subjectId: sid },
      ...(questionIds.length > 0
        ? [{ sourceGroupQuestionId: { $in: questionIds }, scope: "personal" as const }]
        : []),
    ],
  });

  await Promise.all([
    questionIds.length > 0
      ? QuestionProgress.deleteMany({ questionId: { $in: questionIds } })
      : Promise.resolve(),
    topicIds.length > 0
      ? TopicProgress.deleteMany({ topicId: { $in: topicIds } })
      : Promise.resolve(),
    Topic.deleteMany({ subjectId: sid }),
    PrepTask.deleteMany({
      $or: [
        { subjectId: sid },
        ...(questionIds.length > 0 ? [{ questionId: { $in: questionIds } }] : []),
      ],
    }),
    MockInterview.deleteMany({ subjectId: sid }),
    MockInterviewSession.deleteMany({ "questions.subjectId": sid }),
    StudySession.deleteMany({ subjectId: sid }),
    PreparationPlan.deleteMany({ subjectId: sid }),
    Subject.deleteOne({ _id: sid }),
  ]);
}

export async function clearActiveGroupForMembers(groupId: string) {
  await User.updateMany(
    { activeGroupId: new mongoose.Types.ObjectId(groupId) },
    { $unset: { activeGroupId: 1 } }
  );
}

export interface MemberStat {
  userId: string;
  name: string;
  tasksCompleted: number;
  role?: GroupRole;
}

export async function getGroupInsights(
  groupId: string,
  memberIds: string[],
  roleMap?: Map<string, GroupRole>
): Promise<{ memberStats: MemberStat[]; gamification: GroupGamification }> {
  return getCached(groupInsightsCacheKey(groupId), GROUP_INSIGHTS_TTL_MS, async () => {
    const ctx = await loadGroupStatsContext(groupId, memberIds);
    if (!ctx) {
      return { memberStats: [], gamification: buildGroupGamification([]) };
    }
    return {
      memberStats: memberStatsFromContext(memberIds, roleMap, ctx),
      gamification: gamificationFromContext(memberIds, ctx),
    };
  });
}

export async function getMemberStatsBatch(
  memberIds: string[],
  groupId: string,
  roleMap?: Map<string, GroupRole>
): Promise<MemberStat[]> {
  const ctx = await loadGroupStatsContext(groupId, memberIds);
  if (!ctx) return [];
  return memberStatsFromContext(memberIds, roleMap, ctx);
}

export async function getGroupGamificationStats(
  groupId: string,
  memberIds: string[]
): Promise<GroupGamification> {
  const ctx = await loadGroupStatsContext(groupId, memberIds);
  if (!ctx) return buildGroupGamification([]);
  return gamificationFromContext(memberIds, ctx);
}

/** Group tab question list — one DB round-trip for progress (scoped by question ids). */
export async function listGroupPracticeQuestionsForUser(groupId: string, userId: string) {
  const [questions, subjects] = await Promise.all([
    PracticeQuestion.find({ groupId, scope: "group" })
      .sort({ practiceDate: -1, createdAt: -1 })
      .lean(),
    Subject.find({ groupId, scope: "group", isActive: true })
      .sort({ order: 1 })
      .select("name totalQuestions contentUnit")
      .lean(),
  ]);

  const questionIds = questions.map((q) => q._id);
  const progress =
    questionIds.length > 0
      ? await QuestionProgress.find({
          userId,
          questionId: { $in: questionIds },
        }).lean()
      : [];

  const subjectMap = new Map(subjects.map((s) => [String(s._id), s]));
  const progressMap = new Map(progress.map((p) => [String(p.questionId), p]));
  const activeSubjectIds = new Set(subjectMap.keys());

  return questions
    .filter((q) => activeSubjectIds.has(String(q.subjectId)))
    .map((q) => {
    const base = serializeDoc(q);
    const subject = subjectMap.get(String(q.subjectId));
    const p = progressMap.get(String(q._id));
    const practiceDate = q.practiceDate?.toISOString();
    const fields = questionProgressFields(p, q);
    return {
      ...base,
      ...(practiceDate ? { practiceDate } : {}),
      subjectName: subject?.name ?? "",
      trackLabel: subject
        ? formatSubjectTrack({
            name: subject.name,
            totalQuestions: subject.totalQuestions ?? 0,
            contentUnit: subject.contentUnit ?? "questions",
          })
        : "",
      ...fields,
    };
  });
}

function mapTodayQuestion(
  q: {
    _id: unknown;
    scope: "group" | "personal";
    content: string;
    subjectId: unknown;
    practiceDate?: Date;
    createdAt: Date;
    link?: string;
    status?: string;
  },
  subjectMap: Map<string, { name: string; totalQuestions?: number; contentUnit?: ContentUnit }>,
  progressMap: Map<string, { status?: string }>
): TodayQuestion {
  const subject = subjectMap.get(String(q.subjectId));
  const trackLabel = subject
    ? formatSubjectTrack({
        name: subject.name,
        totalQuestions: subject.totalQuestions ?? 0,
        contentUnit: subject.contentUnit ?? "questions",
      })
    : "";
  const status = questionStatusForUser(progressMap.get(String(q._id)), q);

  return {
    _id: String(q._id),
    content: q.content,
    scope: q.scope,
    subjectName: subject?.name ?? "",
    trackLabel,
    status,
    practiceDate: q.practiceDate?.toISOString(),
    link: q.link,
  };
}

export async function getTodayQuestionsForUser(
  userId: string,
  groupId: string
): Promise<{ group: TodayQuestion[]; personal: TodayQuestion[] }> {
  const range = questionDatePeriodRange("today");
  if (!range) return { group: [], personal: [] };

  const dateFilter = { practiceDate: { $gte: range.start, $lt: range.end } };

  const [groupQuestions, personalQuestions, subjects] = await Promise.all([
    PracticeQuestion.find({ groupId, scope: "group", ...dateFilter })
      .sort({ practiceDate: -1, createdAt: -1 })
      .lean(),
    PracticeQuestion.find({
      userId,
      groupId,
      scope: "personal",
      ...NATIVE_PERSONAL_QUESTION_FILTER,
      ...dateFilter,
    })
      .sort({ practiceDate: -1, createdAt: -1 })
      .lean(),
    Subject.find({
      $or: [
        { groupId, scope: "group", isActive: true },
        { userId, scope: "personal", isActive: true },
      ],
    }).lean(),
  ]);

  const questionIds = [
    ...groupQuestions.map((q) => q._id),
    ...personalQuestions.map((q) => q._id),
  ];
  const progress =
    questionIds.length > 0
      ? await QuestionProgress.find({ userId, questionId: { $in: questionIds } }).lean()
      : [];

  const subjectMap = new Map(
    subjects.map((s) => [
      String(s._id),
      { name: s.name, totalQuestions: s.totalQuestions, contentUnit: s.contentUnit },
    ])
  );
  const progressMap = new Map(progress.map((p) => [String(p.questionId), p]));
  const activeSubjectIds = new Set(subjectMap.keys());

  return {
    group: groupQuestions
      .filter((q) => activeSubjectIds.has(String(q.subjectId)))
      .map((q) => mapTodayQuestion({ ...q, scope: "group" }, subjectMap, progressMap)),
    personal: personalQuestions
      .filter((q) => activeSubjectIds.has(String(q.subjectId)))
      .map((q) =>
        mapTodayQuestion({ ...q, scope: "personal" }, subjectMap, progressMap)
      ),
  };
}

export async function updateStudyStreak(userId: string) {
  const user = await User.findById(userId);
  if (!user) return;

  const today = startOfDay(new Date());
  const lastStudy = user.lastStudyDate ? startOfDay(user.lastStudyDate) : null;

  if (!lastStudy) {
    user.studyStreak = 1;
  } else {
    const diffDays = (today.getTime() - lastStudy.getTime()) / 86400000;
    if (diffDays === 0) return; // already studied today
    user.studyStreak = diffDays === 1 ? user.studyStreak + 1 : 1;
  }

  user.lastStudyDate = new Date();
  await user.save();
}

export { serializeDoc };
