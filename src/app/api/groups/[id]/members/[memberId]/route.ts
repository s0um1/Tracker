import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError } from "@/lib/utils";
import { invalidateGroupInsights, isGroupMember, serializeDoc } from "@/lib/services";
import { canPromoteToCoAdmin, canRemoveGroupMember } from "@/lib/group-roles";
import type { GroupRole } from "@/types";
import Group from "@/models/Group";
import User from "@/models/User";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id, memberId } = await params;
    const body = await request.json();
    const nextRole = body.role as GroupRole | undefined;

    if (nextRole !== "admin" && nextRole !== "member") {
      return jsonError("role must be admin (co-admin) or member", 400);
    }

    const group = await Group.findById(id);
    if (!group) return jsonError("Group not found", 404);

    const callerRole = isGroupMember(group, userId);
    if (!canPromoteToCoAdmin(callerRole)) {
      return jsonError("Only the group admin can change co-admin roles", 403);
    }

    const targetMember = group.members.find((m) => String(m.userId) === memberId);
    if (!targetMember) return jsonError("Member not found", 404);
    if (targetMember.role === "owner") {
      return jsonError("Cannot change the group admin role", 400);
    }

    targetMember.role = nextRole;
    await group.save();
    invalidateGroupInsights(id);

    return jsonOk(serializeDoc(group));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to update member role", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id, memberId } = await params;

    const group = await Group.findById(id);
    if (!group) return jsonError("Group not found", 404);

    const callerRole = isGroupMember(group, userId);
    if (!callerRole) return jsonError("Unauthorized", 403);

    const targetMember = group.members.find((m) => String(m.userId) === memberId);
    if (!targetMember) return jsonError("Member not found", 404);

    const isSelf = memberId === userId;
    const targetRole = targetMember.role as GroupRole;

    if (!canRemoveGroupMember(callerRole, targetRole, isSelf)) {
      if (targetRole === "owner") {
        return jsonError("Cannot remove the group admin", 400);
      }
      if (targetRole === "admin" && callerRole === "admin") {
        return jsonError("Co-admins cannot remove other co-admins", 403);
      }
      return jsonError("You cannot remove this member", 403);
    }

    group.members = group.members.filter((m) => String(m.userId) !== memberId);
    await group.save();
    invalidateGroupInsights(id);

    const memberUser = await User.findById(memberId);
    if (memberUser && String(memberUser.activeGroupId) === id) {
      memberUser.activeGroupId = undefined;
      await memberUser.save();
    }

    return jsonOk(serializeDoc(group));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to remove member", 500);
  }
}
