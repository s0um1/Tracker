import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { jsonOk, jsonError } from "@/lib/utils";
import { serializeDoc } from "@/lib/services";
import Group from "@/models/Group";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const { id } = await params;
    const body = await request.json();
    const newOwnerId = String(body.newOwnerId ?? "").trim();

    if (!newOwnerId) return jsonError("newOwnerId is required", 400);
    if (newOwnerId === userId) return jsonError("You are already the group admin", 400);

    const group = await Group.findById(id);
    if (!group) return jsonError("Group not found", 404);
    if (String(group.ownerId) !== userId) return jsonError("Only the group admin can transfer the admin role", 403);

    const newOwnerMember = group.members.find((m) => String(m.userId) === newOwnerId);
    if (!newOwnerMember) return jsonError("New owner must be a group member", 400);

    const currentOwner = group.members.find((m) => m.role === "owner");
    if (currentOwner) currentOwner.role = "member";
    newOwnerMember.role = "owner";
    group.ownerId = newOwnerMember.userId;
    await group.save();

    return jsonOk(serializeDoc(group));
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to transfer ownership", 500);
  }
}
