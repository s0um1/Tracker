import mongoose from "mongoose";
import { withAuth } from "@/lib/api-handler";
import { isDuplicateKeyError } from "@/lib/db-indexes";
import { jsonOk, jsonError } from "@/lib/utils";
import { isGroupMember, canManageGroup } from "@/lib/services";
import { pickMockInterviewQuestions } from "@/lib/mock-interview";
import MockInterviewSession from "@/models/MockInterviewSession";
import Group from "@/models/Group";
import User from "@/models/User";
import {
  listMockRounds,
  getCurrentRound,
  roundInterviewDates,
  isOnMockInterviewDate,
} from "@/lib/mock-rounds";

export const POST = withAuth(async (request, { userId }) => {
  const body = await request.json();
  const { intervieweeId, groupId, roundId: roundIdParam } = body;

  if (!intervieweeId || !groupId) {
    return jsonError("intervieweeId and groupId are required");
  }

  const group = await Group.findById(groupId).lean();
  if (!group) return jsonError("Group not found", 404);
  const role = isGroupMember(group, userId);
  if (!role) return jsonError("Unauthorized", 403);
  if (!canManageGroup(role)) {
    return jsonError("Only admins and co-admins can generate mock questions", 403);
  }
  if (!group.members.some((m) => String(m.userId) === intervieweeId)) {
    return jsonError("Interviewee is not a group member", 400);
  }
  if (String(intervieweeId) === userId) {
    return jsonError("Cannot generate mock questions for yourself", 400);
  }

  const rounds = await listMockRounds(groupId);
  const currentRound = getCurrentRound(rounds);
  const activeRound =
    (roundIdParam ? rounds.find((r) => String(r._id) === roundIdParam) : null) ??
    currentRound;
  if (!activeRound) return jsonError("No active mock round", 400);
  if (currentRound && String(activeRound._id) !== String(currentRound._id)) {
    return jsonError("Questions can only be generated for the current mock date", 400);
  }

  const interviewDates = await roundInterviewDates(groupId, rounds);
  const mockDate = interviewDates.get(String(activeRound._id));
  if (!isOnMockInterviewDate(mockDate)) {
    return jsonError("Questions can only be generated on the mock interview date", 400);
  }

  const roundObjectId = new mongoose.Types.ObjectId(String(activeRound._id));
  const existing = await MockInterviewSession.findOne({
    groupId: new mongoose.Types.ObjectId(groupId),
    roundId: roundObjectId,
    intervieweeId: new mongoose.Types.ObjectId(intervieweeId),
  }).lean();
  if (existing) {
    return jsonError("Questions have already been generated for this member this round", 409);
  }

  const interviewee = await User.findById(intervieweeId).lean();
  if (!interviewee) return jsonError("Interviewee not found", 404);

  const questions = await pickMockInterviewQuestions(groupId, intervieweeId);
  if (questions.length === 0) {
    return jsonError(
      "No done questions found for this member — they must mark questions as done first",
      400
    );
  }

  let session;
  try {
    session = await MockInterviewSession.create({
      groupId: new mongoose.Types.ObjectId(groupId),
      roundId: roundObjectId,
      intervieweeId: new mongoose.Types.ObjectId(intervieweeId),
      generatedBy: new mongoose.Types.ObjectId(userId),
      questions: questions.map((q) => ({
        subjectId: q.subjectId,
        subjectName: q.subjectName,
        topicId: q.topicId,
        questionId: q.questionId,
        question: q.question,
        source: q.source,
      })),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      return jsonError("Questions have already been generated for this member this round", 409);
    }
    throw err;
  }

  return jsonOk(
    {
      sessionId: String(session._id),
      intervieweeId,
      intervieweeName: interviewee.name,
      questions,
    },
    201
  );
}, "Failed to generate questions");
