import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import {
  jsonOk,
  jsonError,
  parseDateInput,
  normalizeQuestionStatus,
  isQuestionStatusPracticed,
  resolveQuestionBody,
} from "@/lib/utils";
import { applyFirstDonePoints } from "@/lib/question-gamification";
import {
  serializeDoc,
  isGroupMember,
  canManageGroup,
  invalidateGroupInsights,
  syncGroupProgressToPersonal,
  syncQuestionTodoTask,
} from "@/lib/services";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";
import PrepTask from "@/models/PrepTask";
import Subject from "@/models/Subject";
import Group from "@/models/Group";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id } = await params;
    const body = await request.json();

    const question = await PracticeQuestion.findById(id).lean();
    if (!question) return jsonError("Question not found", 404);

    const group = await Group.findById(question.groupId).lean();
    const role = group ? isGroupMember(group, userId) : null;
    if (!role) return jsonError("Not authorized", 403);

    const isOwner = String(question.userId) === userId;
    const canEditContent = isOwner || (question.scope === "group" && canManageGroup(role));
    const nextStatus = body.status ? normalizeQuestionStatus(body.status) : undefined;
    let pointsEarnedNow: number | undefined;

    if (question.scope === "group" && (nextStatus || body.confidence || body.notes !== undefined)) {
      const existing = await QuestionProgress.findOne({ userId, questionId: id }).lean();
      const prevStatus = normalizeQuestionStatus(existing?.status ?? "not_started");
      const progressUpdates: Record<string, unknown> = {};
      if (nextStatus) {
        progressUpdates.status = nextStatus;
        if (isQuestionStatusPracticed(nextStatus)) progressUpdates.lastPracticed = new Date();
        if (nextStatus === "done") {
          const award = applyFirstDonePoints(
            prevStatus,
            nextStatus,
            question.practiceDate ?? question.createdAt,
            existing ?? undefined
          );
          if (award.pointsAwarded != null) progressUpdates.pointsAwarded = award.pointsAwarded;
          if (award.firstCompletedAt) progressUpdates.firstCompletedAt = award.firstCompletedAt;
          pointsEarnedNow = award.pointsEarnedNow;
        }
      }
      if (body.confidence) progressUpdates.confidence = body.confidence;
      if (body.notes !== undefined) progressUpdates.notes = body.notes?.trim() || undefined;

      const progress = await QuestionProgress.findOneAndUpdate(
        { userId, questionId: id },
        progressUpdates,
        { new: true, upsert: true }
      ).lean();

      if (progress) {
        const status = normalizeQuestionStatus(progress.status);
        await syncGroupProgressToPersonal(userId, question, {
          status,
          confidence: progress.confidence,
          lastPracticed: progress.lastPracticed,
          notes: progress.notes,
        });
        await syncQuestionTodoTask(userId, question, status);
      }

      invalidateGroupInsights(String(question.groupId));

      if (!canEditContent) {
        return jsonOk({
          ...serializeDoc(question),
          status: normalizeQuestionStatus(progress?.status ?? "not_started"),
          confidence: progress?.confidence ?? "weak",
          lastPracticed: progress?.lastPracticed?.toISOString(),
          pointsAwarded: progress?.pointsAwarded,
          firstCompletedAt: progress?.firstCompletedAt?.toISOString(),
          pointsEarnedNow,
          notes: progress?.notes,
        });
      }
    }

    if (!canEditContent) return jsonError("Not authorized to edit this question", 403);

    const updates: Record<string, unknown> = {};
    if (body.title !== undefined || body.content !== undefined || body.description !== undefined) {
      const resolved = resolveQuestionBody({
        content: body.content,
        title: body.title,
        description: body.description,
      });
      if ("error" in resolved) return jsonError(resolved.error);
      updates.content = resolved.content;
    }
    if (body.link !== undefined) updates.link = body.link?.trim() || undefined;
    if (body.difficulty) updates.difficulty = body.difficulty;
    if (body.subjectId) {
      const subject = await Subject.findById(body.subjectId).lean();
      if (!subject) return jsonError("Subject not found", 404);
      if (question.scope === "group" && subject.scope !== "group") {
        return jsonError("Group questions must use a group subject");
      }
      if (question.scope === "personal") {
        if (subject.scope !== "personal") {
          return jsonError("Personal questions must use a personal subject");
        }
        if (String(subject.userId) !== userId) {
          return jsonError("Subject does not belong to you", 403);
        }
      }
      updates.subjectId = body.subjectId;
    }
    if (question.scope === "personal") {
      if (nextStatus) {
        updates.status = nextStatus;
        if (isQuestionStatusPracticed(nextStatus)) updates.lastPracticed = new Date();
      }
      if (body.confidence) updates.confidence = body.confidence;
      if (body.notes !== undefined) updates.notes = body.notes?.trim() || undefined;
    }
    if (body.topicId !== undefined) updates.topicId = body.topicId || undefined;
    if (body.practiceDate) updates.practiceDate = parseDateInput(body.practiceDate);

    const updated = await PracticeQuestion.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!updated) return jsonError("Question not found", 404);

    if (updated.scope === "personal" && nextStatus) {
      await syncQuestionTodoTask(userId, updated, nextStatus);
    }

    if (updated.scope === "group") {
      const progress = await QuestionProgress.findOne({ userId, questionId: id }).lean();
      return jsonOk({
        ...serializeDoc(updated),
        status: normalizeQuestionStatus(progress?.status ?? "not_started"),
        confidence: progress?.confidence ?? "weak",
        lastPracticed: progress?.lastPracticed?.toISOString(),
        pointsAwarded: progress?.pointsAwarded,
        firstCompletedAt: progress?.firstCompletedAt?.toISOString(),
        pointsEarnedNow,
        notes: progress?.notes,
      });
    }

    return jsonOk({
      ...serializeDoc(updated),
      status: normalizeQuestionStatus(updated.status ?? "not_started"),
    });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to update question", 500);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id } = await params;

    const question = await PracticeQuestion.findById(id).lean();
    if (!question) return jsonError("Question not found", 404);

    const group = await Group.findById(question.groupId).lean();
    const role = group ? isGroupMember(group, userId) : null;
    if (!role) return jsonError("Not authorized", 403);

    const isOwner = String(question.userId) === userId;
    const canDelete =
      isOwner || (question.scope === "group" && canManageGroup(role));
    if (!canDelete) return jsonError("Not authorized to delete this question", 403);

    await QuestionProgress.deleteMany({ questionId: id });
    await PrepTask.deleteMany({ questionId: id });
    await PracticeQuestion.deleteMany({ sourceGroupQuestionId: id, scope: "personal" });
    await PracticeQuestion.findByIdAndDelete(id);
    return jsonOk({ deleted: true });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to delete question", 500);
  }
}
