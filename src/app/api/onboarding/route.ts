import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError } from "@/lib/utils";
import { serializeDoc, seedGroupSubjects } from "@/lib/services";
import { normalizeUser } from "@/lib/user";
import {
  generateJoinCode,
  joinCodeExpiryDate,
  isGroupFull,
  isJoinCodeActive,
  isValidJoinCode,
  MAX_GROUP_MEMBERS,
  normalizeJoinCode,
} from "@/lib/utils";
import User from "@/models/User";
import Group from "@/models/Group";

export async function POST(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const body = await request.json();
    const {
      name, subjects, dailyStudyMinutes,
      preparationLevel, groupAction, groupName, joinCode,
    } = body;

    const user = await User.findById(userId);
    if (!user) return jsonError("User not found", 404);
    if (user.onboardingComplete) return jsonError("Onboarding already complete");

    if (name?.trim()) user.name = name.trim();
    user.preparationLevel = preparationLevel ?? user.preparationLevel;
    user.dailyStudyMinutes = dailyStudyMinutes ?? user.dailyStudyMinutes;

    let group;

    if (groupAction === "join" && joinCode) {
      const normalized = normalizeJoinCode(joinCode);
      if (!isValidJoinCode(normalized)) return jsonError("Join code must be 6 digits");
      group = await Group.findOne({ joinCode: normalized });
      if (!group) return jsonError("Invalid join code", 404);
      if (!isJoinCodeActive(group.joinCode, group.joinCodeExpiresAt)) {
        return jsonError("Join code has expired. Ask the group owner for a new code.", 400);
      }
      const alreadyMember = group.members.some((m) => String(m.userId) === userId);
      if (!alreadyMember) {
        if (isGroupFull(group.members.length)) {
          return jsonError(`This group is full (max ${MAX_GROUP_MEMBERS} members)`, 400);
        }
        group.members.push({ userId: user._id, role: "member", joinedAt: new Date() });
        await group.save();
      }
    } else {
      let code = generateJoinCode();
      while (await Group.findOne({ joinCode: code })) {
        code = generateJoinCode();
      }

      group = await Group.create({
        name: groupName?.trim() || `${user.name}'s Prep Group`,
        joinCode: code,
        joinCodeExpiresAt: joinCodeExpiryDate(),
        ownerId: user._id,
        members: [{ userId: user._id, role: "owner", joinedAt: new Date() }],
      });

      if (subjects?.length) {
        await seedGroupSubjects(String(group._id), subjects);
      }
    }

    user.activeGroupId = group._id;
    user.onboardingComplete = true;
    await user.save();

    return jsonOk({
      user: normalizeUser(user),
      group: serializeDoc(group),
    }, 201);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Onboarding failed", 500);
  }
}
