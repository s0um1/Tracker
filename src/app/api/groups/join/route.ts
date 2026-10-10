import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import {
  jsonOk,
  jsonError,
  isGroupFull,
  isJoinCodeActive,
  isValidJoinCode,
  MAX_GROUP_MEMBERS,
  normalizeJoinCode,
} from "@/lib/utils";
import { serializeDoc } from "@/lib/services";
import Group from "@/models/Group";
import Subject from "@/models/Subject";
import User from "@/models/User";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const body = await request.json();
    const { code } = body;
    if (!code?.trim()) return jsonError("Join code is required");
    const normalized = normalizeJoinCode(code);
    if (!isValidJoinCode(normalized)) return jsonError("Join code must be 6 digits");

    const group = await Group.findOne({ joinCode: normalized }).lean();
    if (!group) return jsonError("Invalid join code", 404);
    if (!isJoinCodeActive(group.joinCode, group.joinCodeExpiresAt)) {
      return jsonError("Join code has expired. Ask the group owner for a new code.", 400);
    }

    const subjects = await Subject.find({ groupId: group._id, isActive: true }).lean();

    const memberCount = group.members.length;
    return jsonOk({
      ...serializeDoc(group),
      memberCount,
      isFull: isGroupFull(memberCount),
      maxMembers: MAX_GROUP_MEMBERS,
      subjects: subjects.map((s) => s.name),
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to preview group", 500);
  }
}

export async function PUT(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const body = await request.json();
    const { code } = body;
    if (!code?.trim()) return jsonError("Join code is required");
    const normalized = normalizeJoinCode(code);
    if (!isValidJoinCode(normalized)) return jsonError("Join code must be 6 digits");

    const group = await Group.findOne({ joinCode: normalized });
    if (!group) return jsonError("Invalid join code", 404);
    if (!isJoinCodeActive(group.joinCode, group.joinCodeExpiresAt)) {
      return jsonError("Join code has expired. Ask the group owner for a new code.", 400);
    }

    const alreadyMember = group.members.some((m) => String(m.userId) === userId);
    if (alreadyMember) return jsonError("Already a member of this group", 400);
    if (isGroupFull(group.members.length)) {
      return jsonError(`This group is full (max ${MAX_GROUP_MEMBERS} members)`, 400);
    }

    group.members.push({ userId: new mongoose.Types.ObjectId(userId), role: "member", joinedAt: new Date() });
    await group.save();

    await User.findByIdAndUpdate(userId, { activeGroupId: group._id });

    return jsonOk(serializeDoc(group));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to join group", 500);
  }
}
