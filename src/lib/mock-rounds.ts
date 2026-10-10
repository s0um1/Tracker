import mongoose from "mongoose";
import { ensureMockInterviewIndexes, isDuplicateKeyError } from "@/lib/db-indexes";
import { isSameIstDay } from "@/lib/utils";
import MockInterviewRound from "@/models/MockInterviewRound";
import MockInterviewSlot from "@/models/MockInterviewSlot";
import PracticeQuestion from "@/models/PracticeQuestion";
import QuestionProgress from "@/models/QuestionProgress";

export function mockObjectIds(groupId: string, roundId: string, intervieweeId: string) {
  return {
    groupId: new mongoose.Types.ObjectId(groupId),
    roundId: new mongoose.Types.ObjectId(roundId),
    intervieweeId: new mongoose.Types.ObjectId(intervieweeId),
  };
}

export async function upsertMockInterviewSlot(params: {
  groupId: string;
  roundId: string;
  intervieweeId: string;
  scheduledAt: Date;
  scheduledBy: string;
}) {
  await ensureMockInterviewIndexes();
  const ids = mockObjectIds(params.groupId, params.roundId, params.intervieweeId);
  return MockInterviewSlot.findOneAndUpdate(
    ids,
    {
      $set: {
        scheduledAt: params.scheduledAt,
        scheduledBy: new mongoose.Types.ObjectId(params.scheduledBy),
      },
      $setOnInsert: ids,
    },
    { upsert: true, new: true, runValidators: true }
  );
}

export type MockRoundRecord = {
  _id: { toString(): string };
  roundNumber: number;
  interviewDate?: Date;
  startsAt: Date;
  createdAt: Date;
};

export async function listMockRounds(groupId: string): Promise<MockRoundRecord[]> {
  let rounds = await MockInterviewRound.find({ groupId }).sort({ roundNumber: 1 }).lean();
  if (rounds.length === 0) {
    const now = new Date();
    try {
      const created = await MockInterviewRound.create({
        groupId,
        roundNumber: 1,
        startsAt: now,
        endsAt: now,
      });
      rounds = [created.toObject() as (typeof rounds)[number]];
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err;
      rounds = await MockInterviewRound.find({ groupId }).sort({ roundNumber: 1 }).lean();
    }
  }
  return rounds as MockRoundRecord[];
}

export async function createNextMockRound(
  groupId: string,
  interviewDate: Date
): Promise<MockRoundRecord> {
  const rounds = await listMockRounds(groupId);
  const nextNumber = rounds.length + 1;
  try {
    const created = await MockInterviewRound.create({
      groupId,
      roundNumber: nextNumber,
      interviewDate,
      startsAt: interviewDate,
      endsAt: interviewDate,
    });
    return created.toObject() as MockRoundRecord;
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    const latest = await MockInterviewRound.findOne({ groupId })
      .sort({ roundNumber: -1 })
      .lean();
    if (!latest) throw err;
    return latest as MockRoundRecord;
  }
}

export function getCurrentRound(rounds: MockRoundRecord[]) {
  return rounds[rounds.length - 1] ?? null;
}

export function isOnMockInterviewDate(interviewDate?: Date | string | null): boolean {
  if (!interviewDate) return false;
  return isSameIstDay(interviewDate);
}

export function resolveRoundDate(
  round: Pick<MockRoundRecord, "interviewDate" | "startsAt">,
  slotDate?: Date | null
): Date | null {
  return round.interviewDate ?? slotDate ?? round.startsAt ?? null;
}

export async function roundInterviewDates(
  groupId: string,
  rounds: MockRoundRecord[]
): Promise<Map<string, Date | null>> {
  const roundIds = rounds.map((r) => String(r._id));
  const slots = await MockInterviewSlot.find({
    groupId,
    roundId: { $in: roundIds },
  }).lean();

  const slotByRound = new Map<string, Date>();
  for (const slot of slots) {
    const key = String(slot.roundId);
    const existing = slotByRound.get(key);
    if (!existing || slot.scheduledAt < existing) {
      slotByRound.set(key, slot.scheduledAt);
    }
  }

  const map = new Map<string, Date | null>();
  for (const round of rounds) {
    const id = String(round._id);
    map.set(id, resolveRoundDate(round, slotByRound.get(id)));
  }
  return map;
}

/** All group questions marked done, optionally capped at an interview date. */
export async function countQuestionsDoneTill(
  userId: string,
  groupId: string,
  until?: Date
): Promise<number> {
  const counts = await countQuestionsDoneBatch([userId], groupId, until);
  return counts.get(userId) ?? 0;
}

/** One query for all members — avoids re-loading group question ids per member. */
export async function countQuestionsDoneBatch(
  memberIds: string[],
  groupId: string,
  until?: Date
): Promise<Map<string, number>> {
  const zeros = new Map(memberIds.map((id) => [id, 0]));
  if (memberIds.length === 0) return zeros;

  const questionIds = await PracticeQuestion.find({ groupId, scope: "group" }).distinct("_id");
  if (questionIds.length === 0) return zeros;

  const match: Record<string, unknown> = {
    userId: { $in: memberIds.map((id) => new mongoose.Types.ObjectId(id)) },
    questionId: { $in: questionIds },
    status: "done",
  };
  if (until) {
    match.lastPracticed = { $lte: until };
  }

  const rows = await QuestionProgress.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: match },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);

  for (const row of rows) {
    zeros.set(String(row._id), row.count);
  }
  return zeros;
}
