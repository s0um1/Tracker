import { connectToDatabase } from "@/lib/mongodb";
import { requireAuthUserId, unauthorized } from "@/lib/api-auth";
import { joinCodeExpiryDate, jsonOk, jsonError, generateJoinCode } from "@/lib/utils";
import { serializeDoc, seedGroupSubjects } from "@/lib/services";
import Group from "@/models/Group";
import User from "@/models/User";
import Subject from "@/models/Subject";

export async function GET(request: Request) {
  try {
    const userId = requireAuthUserId(request);
    await connectToDatabase();
    const filter = { "members.userId": userId };

    const groups = await Group.find(filter).sort({ createdAt: -1 }).lean();
    const groupIds = groups.map((g) => g._id);
    const allSubjects = groupIds.length
      ? await Subject.find({ groupId: { $in: groupIds }, isActive: true }).lean()
      : [];

    const subjectsByGroup = new Map<string, string[]>();
    for (const s of allSubjects) {
      const gid = String(s.groupId);
      const list = subjectsByGroup.get(gid) ?? [];
      list.push(s.name);
      subjectsByGroup.set(gid, list);
    }

    const result = groups.map((g) => {
      const me = g.members.find((m) => String(m.userId) === userId);
      return {
        ...serializeDoc(g),
        memberCount: g.members.length,
        subjects: subjectsByGroup.get(String(g._id)) ?? [],
        myRole: me?.role ?? null,
      };
    });
    return jsonOk(result);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to fetch groups", 500);
  }
}

export async function POST(request: Request) {
  try {
    const ownerId = requireAuthUserId(request);
    await connectToDatabase();
    const body = await request.json();
    const { name, description, interviewDate, subjects } = body;

    if (!name?.trim()) return jsonError("Group name is required");

    let joinCode = generateJoinCode();
    while (await Group.findOne({ joinCode })) {
      joinCode = generateJoinCode();
    }

    const group = await Group.create({
      name: name.trim(),
      description: description?.trim(),
      joinCode,
      joinCodeExpiresAt: joinCodeExpiryDate(),
      interviewDate: interviewDate ? new Date(interviewDate) : undefined,
      ownerId,
      members: [{ userId: ownerId, role: "owner", joinedAt: new Date() }],
    });

    if (subjects?.length) {
      await seedGroupSubjects(String(group._id), subjects);
    }

    await User.findByIdAndUpdate(ownerId, { activeGroupId: group._id });

    return jsonOk(serializeDoc(group), 201);
  } catch (err) {
    if (err instanceof Error && err.message === "Unauthorized") return unauthorized();
    return jsonError(err instanceof Error ? err.message : "Failed to create group", 500);
  }
}
