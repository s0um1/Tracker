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
import { questionProgressFields } from "@/lib/question-progress";
import {
  serializeDoc,
  isGroupMember,
  canManageGroup,
  invalidateGroupInsights,
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

    const hasProgressUpdate =
      nextStatus !== undefined || body.confidence || body.notes !== undefined;

    if (hasProgressUpdate) {
      const existing = await QuestionProgress.findOne({ userId, questionId: id }).lean();
      const prevStatus = normalizeQuestionStatus(
        existing?.status ?? question.status ?? "not_started"
      );
      const progressUpdates: Record<string, unknown> = {};
      if (nextStatus) {
        progressUpdates.status = nextStatus;
        if (isQuestionStatusPracticed(nextStatus)) progressUpdates.lastPracticed = new Date();
        if (nextStatus === "done") {
          const award = applyFirstDonePoints(
            prevStatus,
            nextStatus,
            question.practiceDate ?? new Date(),
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
        if (question.scope === "personal") {
          await PracticeQuestion.findByIdAndUpdate(id, {
            status: progress.status,
            confidence: progress.confidence,
            lastPracticed: progress.lastPracticed,
            notes: progress.notes,
            ...(progress.pointsAwarded != null ? { pointsAwarded: progress.pointsAwarded } : {}),
            ...(progress.firstCompletedAt
              ? { firstCompletedAt: progress.firstCompletedAt }
              : {}),
          });
        }
        await syncQuestionTodoTask(userId, question, status);
      }

      invalidateGroupInsights(String(question.groupId));

      const progressView = questionProgressFields(progress, question);

      if (!canEditContent) {
        return jsonOk({
          ...serializeDoc(question),
          ...progressView,
          pointsEarnedNow,
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
    if (body.topicId !== undefined) updates.topicId = body.topicId || undefined;
    if (body.practiceDate === null || body.practiceDate === "") {
      updates.$unset = { practiceDate: 1 };
    } else if (body.practiceDate) {
      updates.practiceDate = parseDateInput(body.practiceDate);
    }

    const updated = await PracticeQuestion.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!updated) return jsonError("Question not found", 404);

    const progress = await QuestionProgress.findOne({ userId, questionId: id }).lean();
    const progressView = questionProgressFields(progress, updated);

    return jsonOk({
      ...serializeDoc(updated),
      ...progressView,
      pointsEarnedNow,
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
