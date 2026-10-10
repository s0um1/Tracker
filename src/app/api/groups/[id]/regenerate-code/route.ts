import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError, isJoinCodeActive } from "@/lib/utils";
import { isGroupMember, issueJoinCode, canManageGroup } from "@/lib/services";
import Group from "@/models/Group";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id } = await params;

    const group = await Group.findById(id);
    if (!group) return jsonError("Group not found", 404);
    const role = isGroupMember(group, userId);
    if (!canManageGroup(role)) {
      return jsonError("Only admins and co-admins can generate invite codes", 403);
    }

    const body = await request.json().catch(() => ({}));
    const force = body?.force === true;

    if (
      !force &&
      isJoinCodeActive(group.joinCode, group.joinCodeExpiresAt)
    ) {
      const expiresAt = group.joinCodeExpiresAt;
      return jsonOk({
        joinCode: group.joinCode,
        joinCodeExpiresAt:
          expiresAt instanceof Date ? expiresAt.toISOString() : new Date(expiresAt).toISOString(),
      });
    }

    const { joinCode, joinCodeExpiresAt } = await issueJoinCode(group, id);
    return jsonOk({ joinCode, joinCodeExpiresAt: joinCodeExpiresAt.toISOString() });
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to regenerate code", 500);
  }
}
