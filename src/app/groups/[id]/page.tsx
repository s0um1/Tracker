"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPatch, apiPost, apiDelete, getErrorMessage } from "@/lib/api";
import {
  canManageGroup,
  canPromoteToCoAdmin,
  canRemoveGroupMember,
  formatGroupRoleLabel,
  isGroupAdminRole,
} from "@/lib/group-roles";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { GroupDetailSkeleton, ErrorState } from "@/components/ui/StateViews";
import InviteCodeBlock from "@/components/groups/InviteCodeBlock";
import GroupGamificationPanel from "@/components/groups/GroupGamificationPanel";
import QuestionListView from "@/components/questions/QuestionListView";
import {
  formatSubjectTrack,
  isGroupFull,
  JOIN_CODE_TTL_MINUTES,
  MAX_GROUP_MEMBERS,
  normalizeQuestionStatus,
  toDateInputValue,
} from "@/lib/utils";
import toast from "react-hot-toast";
import {
  triggerQuestionPointsBurst,
  type QuestionPointBurst,
} from "@/lib/question-points-burst";
import type {
  Group,
  GroupGamification,
  GroupRole,
  MemberStat,
  PracticeQuestion,
  QuestionStatus,
  Subject,
} from "@/types";

type GroupQuestion = PracticeQuestion & { subjectName: string; trackLabel?: string };

type GroupDetail = Group & {
  memberStats: (MemberStat & { role: string })[];
  gamification: GroupGamification;
  topicCount: number;
  countdown: { days: number; hours: number; interviewDate: string };
  subjects?: Subject[];
  groupQuestions?: GroupQuestion[];
};

function mergeGroupMembers(prev: GroupDetail, updated: Group): GroupDetail {
  const roleByUser = new Map(
    updated.members.map((m) => [String(m.userId), m.role])
  );
  const memberIds = new Set(updated.members.map((m) => String(m.userId)));
  return {
    ...prev,
    ...updated,
    memberStats: prev.memberStats
      .filter((m) => memberIds.has(m.userId))
      .map((m) => ({
        ...m,
        role: roleByUser.get(m.userId) ?? m.role,
      })),
  };
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const { user, refreshUser } = useUser();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [groupQuestions, setGroupQuestions] = useState<GroupQuestion[]>([]);
  const [pointBurst, setPointBurst] = useState<QuestionPointBurst | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [newQuestionTitle, setNewQuestionTitle] = useState("");
  const [newQuestionDescription, setNewQuestionDescription] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [practiceDate, setPracticeDate] = useState(toDateInputValue());
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [transferring, setTransferring] = useState(false);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [updatingRoleMemberId, setUpdatingRoleMemberId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<GroupDetail>(
        `/api/groups/${groupId}?include=questions,subjects`
      );
      const subjectData = data.subjects ?? [];
      const questionData = data.groupQuestions ?? [];
      setGroup(data);
      setGroupQuestions(questionData);
      setSubjects(subjectData);
      setNewSubjectId((current) =>
        current || subjectData.length === 0 ? current : subjectData[0]._id
      );
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load group"));
      if (!silent) setGroup(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { load(); }, [load]);

  const updateQuestionStatus = async (id: string, status: QuestionStatus) => {
    const normalized = normalizeQuestionStatus(status);
    let previousStatus: QuestionStatus | undefined;
    setGroupQuestions((prev) => {
      const current = prev.find((q) => q._id === id);
      if (!current) return prev;
      previousStatus = current.status;
      return prev.map((q) => (q._id === id ? { ...q, status: normalized } : q));
    });
    if (!previousStatus) return;

    try {
      const updated = await apiPatch<{ pointsEarnedNow?: number }>(
        `/api/practice-questions/${id}`,
        { status: normalized }
      );
      const earned = updated.pointsEarnedNow;
      triggerQuestionPointsBurst(setPointBurst, id, earned);
      if (earned != null && earned > 0 && user?._id) {
        setGroup((prev) => {
          if (!prev?.gamification) return prev;
          const leaderboard = prev.gamification.leaderboard
            .map((m) =>
              m.userId === user._id ? { ...m, totalPoints: m.totalPoints + earned } : m
            )
            .sort((a, b) => b.totalPoints - a.totalPoints);
          return { ...prev, gamification: { ...prev.gamification, leaderboard } };
        });
      }
      if (normalized === "add_to_todo") {
        toast.success("Added to Tasks");
      }
    } catch (err) {
      setGroupQuestions((prev) =>
        prev.map((q) => (q._id === id ? { ...q, status: previousStatus! } : q))
      );
      toast.error(getErrorMessage(err, "Failed to update question"));
    }
  };

  const addGroupQuestion = async () => {
    if (!user || !newQuestionTitle.trim() || !newSubjectId) return;
    try {
      await apiPost("/api/practice-questions", {
        groupId,
        subjectId: newSubjectId,
        title: newQuestionTitle.trim(),
        description: newQuestionDescription.trim(),
        scope: "group",
        practiceDate,
      });
      toast.success("Question added for everyone");
      setShowQuestionModal(false);
      setNewQuestionTitle("");
      setNewQuestionDescription("");
      setPracticeDate(toDateInputValue());
      load({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to add question"));
    }
  };

  const generateInviteCode = useCallback(async (opts?: { force?: boolean }) => {
    setInviteLoading(true);
    try {
      const res = await apiPost<{ joinCode: string; joinCodeExpiresAt: string }>(
        `/api/groups/${groupId}/regenerate-code`,
        opts?.force ? { force: true } : {}
      );
      setGroup((prev) =>
        prev
          ? { ...prev, joinCode: res.joinCode, joinCodeExpiresAt: res.joinCodeExpiresAt }
          : prev
      );
      toast.success("Invite code ready to share");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to generate invite code"));
    } finally {
      setInviteLoading(false);
    }
  }, [groupId]);

  const myRole = (
    group?.memberStats.find((m) => m.userId === user?._id)?.role ??
    group?.members.find((m) => String(m.userId) === user?._id)?.role
  ) as GroupRole | undefined;
  const isGroupAdmin = isGroupAdminRole(myRole);
  const canEditGroup = canManageGroup(myRole);

  const openEditModal = () => {
    if (!group) return;
    setEditName(group.name);
    setEditDescription(group.description ?? "");
    setTransferTargetId("");
    setShowEditModal(true);
  };

  const saveGroup = async () => {
    if (!editName.trim()) return;
    setSavingGroup(true);
    try {
      const updated = await apiPatch<Group>(`/api/groups/${groupId}`, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      });
      setGroup((prev) => (prev ? { ...prev, ...updated } : prev));
      setShowEditModal(false);
      toast.success("Group updated");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update group"));
    } finally {
      setSavingGroup(false);
    }
  };

  const deleteGroup = async () => {
    setDeletingGroup(true);
    try {
      await apiDelete(`/api/groups/${groupId}`);
      await refreshUser();
      toast.success("Group deleted");
      router.push("/groups");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete group"));
    } finally {
      setDeletingGroup(false);
    }
  };

  const setMemberRole = async (memberId: string, role: "admin" | "member") => {
    setUpdatingRoleMemberId(memberId);
    try {
      const updated = await apiPatch<Group>(
        `/api/groups/${groupId}/members/${memberId}`,
        { role }
      );
      setGroup((prev) => (prev ? mergeGroupMembers(prev, updated) : prev));
      toast.success(role === "admin" ? "Co-admin added" : "Co-admin removed");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update role"));
    } finally {
      setUpdatingRoleMemberId(null);
    }
  };

  const removeMember = async (memberId: string) => {
    setRemovingMemberId(memberId);
    try {
      const updated = await apiDelete<Group>(
        `/api/groups/${groupId}/members/${memberId}`
      );
      if (memberId === user?._id) {
        await refreshUser();
        toast.success("You left the group");
        router.push("/groups");
        return;
      }
      setGroup((prev) => (prev ? mergeGroupMembers(prev, updated) : prev));
      toast.success("Member removed");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to remove member"));
    } finally {
      setRemovingMemberId(null);
    }
  };

  const transferOwnership = async () => {
    if (!transferTargetId) return;
    setTransferring(true);
    try {
      const updated = await apiPost<Group>(`/api/groups/${groupId}/transfer-ownership`, {
        newOwnerId: transferTargetId,
      });
      setGroup((prev) => (prev ? mergeGroupMembers(prev, updated) : prev));
      toast.success("Admin role transferred");
      setShowEditModal(false);
      setTransferTargetId("");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to transfer admin role"));
    } finally {
      setTransferring(false);
    }
  };

  const otherMembers = group?.memberStats.filter(
    (m) => m.userId !== user?._id && !isGroupAdminRole(m.role)
  ) ?? [];

  if (loading) return <GroupDetailSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!group) return <ErrorState message="Group not found" onRetry={load} />;

  return (
    <div className="space-y-6">
      {canEditGroup && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" size="sm" onClick={openEditModal}>
            Edit Group
          </Button>
        </div>
      )}

      {group.gamification && <GroupGamificationPanel gamification={group.gamification} />}

      <Card className="!p-4">
        <CardHeader
          title={`Members (${group.memberStats.length}/${MAX_GROUP_MEMBERS})`}
          subtitle={
            isGroupAdmin
              ? "Promote members to co-admin using Make co-admin in the Actions column."
              : undefined
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="pb-2">Member</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Points</th>
                <th className="pb-2">Tasks</th>
                <th className="pb-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {group.memberStats.map((m) => {
                const points =
                  group.gamification?.leaderboard.find((g) => g.userId === m.userId)?.totalPoints ?? 0;
                const isMe = m.userId === user?._id;
                const targetRole = (m.role ??
                  group.members.find((gm) => String(gm.userId) === m.userId)?.role ??
                  "member") as GroupRole;
                const canRemove = canRemoveGroupMember(myRole, targetRole, isMe);
                const canChangeRole =
                  canPromoteToCoAdmin(myRole) && !isMe && !isGroupAdminRole(targetRole);
                return (
                  <tr key={m.userId} className="table-row">
                    <td className="py-2.5 font-medium">
                      <Link href={`/users/${m.userId}`} className="text-brand hover:underline">
                        {m.name}
                        {isMe ? " (you)" : ""}
                      </Link>
                    </td>
                    <td className="py-2.5 text-[var(--muted)]">{formatGroupRoleLabel(targetRole)}</td>
                    <td className="py-2.5 font-semibold text-brand">{points}</td>
                    <td className="py-2.5">{m.tasksCompleted}</td>
                    <td className="py-2.5 text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        {canChangeRole && targetRole === "member" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingRoleMemberId === m.userId}
                            onClick={() => setMemberRole(m.userId, "admin")}
                          >
                            {updatingRoleMemberId === m.userId ? "…" : "Make co-admin"}
                          </Button>
                        )}
                        {canChangeRole && targetRole === "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={updatingRoleMemberId === m.userId}
                            onClick={() => setMemberRole(m.userId, "member")}
                          >
                            {updatingRoleMemberId === m.userId ? "…" : "Remove co-admin"}
                          </Button>
                        )}
                        {canRemove && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={removingMemberId === m.userId}
                            onClick={() => removeMember(m.userId)}
                          >
                            {removingMemberId === m.userId
                              ? "…"
                              : isMe
                                ? "Leave"
                                : "Remove"}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Group Questions"
          subtitle="Shared with everyone — each member tracks their own progress"
          action={
            <div className="flex gap-2">
              <Link href="/questions">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
              {canEditGroup && (
                <Button size="sm" onClick={() => setShowQuestionModal(true)} disabled={subjects.length === 0}>
                  Add Question
                </Button>
              )}
            </div>
          }
        />
        {groupQuestions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No group questions yet. Add questions everyone should practice together.
          </p>
        ) : (
          <QuestionListView
            pointBurst={pointBurst}
            questions={groupQuestions.map((q) => ({ ...q, scope: "group" as const }))}
            onStatusChange={updateQuestionStatus}
          />
        )}
      </Card>

      <Card>
        <CardHeader title="Invite Members" />
        {canEditGroup ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--muted)]">
              Generate a short-lived invite code when you are ready to add someone. Codes expire after{" "}
              {JOIN_CODE_TTL_MINUTES} minutes.
            </p>
            {isGroupFull(group.memberStats.length) ? (
              <p className="text-sm text-[var(--muted)]">
                Group is full ({MAX_GROUP_MEMBERS}/{MAX_GROUP_MEMBERS} members).
              </p>
            ) : (
              <InviteCodeBlock
                joinCode={group.joinCode}
                joinCodeExpiresAt={group.joinCodeExpiresAt}
                onGenerate={generateInviteCode}
                generating={inviteLoading}
              />
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--muted)]">
            Ask a group admin or co-admin for a fresh invite code when you want to add a teammate.
          </p>
        )}
      </Card>

      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Group">
        <div className="space-y-5">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Group name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-3 py-1.5 text-sm dark:bg-[var(--input-bg)]"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <input
                type="text"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional"
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-3 py-1.5 text-sm dark:bg-[var(--input-bg)]"
              />
            </div>
            <div className="flex justify-end pt-1">
              <Button
                size="sm"
                onClick={saveGroup}
                disabled={savingGroup || !editName.trim()}
              >
                {savingGroup ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>

          {isGroupAdmin && otherMembers.length > 0 && (
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Transfer admin role</h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  New admin takes over; you become a regular member.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--input-border)] px-3 py-1.5 text-sm dark:bg-[var(--input-bg)]"
                >
                  <option value="">Select member…</option>
                  {otherMembers.map((m) => (
                    <option key={m.userId} value={m.userId}>{m.name}</option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 sm:w-auto"
                  disabled={!transferTargetId || transferring}
                  onClick={transferOwnership}
                >
                  {transferring ? "Transferring…" : "Transfer"}
                </Button>
              </div>
            </div>
          )}

          {isGroupAdmin && (
            <div className="space-y-2 border-t border-[var(--border)] pt-4">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Delete group</h3>
                <p className="mt-0.5 text-xs text-[var(--muted)]">
                  Permanently deletes <strong>{group.name}</strong> and all questions, subjects, and
                  progress.
                </p>
              </div>
              <Button
                variant="danger"
                size="sm"
                disabled={deletingGroup}
                onClick={deleteGroup}
              >
                {deletingGroup ? "Deleting…" : "Delete group"}
              </Button>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={showQuestionModal} onClose={() => setShowQuestionModal(false)} title="Add Group Question">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Assigned to every group member. Each person marks their own progress.
          </p>
          <div>
            <label className="text-sm font-medium">Practice date</label>
            <input
              type="date"
              value={practiceDate}
              onChange={(e) => setPracticeDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Track</label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            >
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{formatSubjectTrack(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={newQuestionTitle}
              onChange={(e) => setNewQuestionTitle(e.target.value)}
              placeholder="Short question title"
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={newQuestionDescription}
              onChange={(e) => setNewQuestionDescription(e.target.value)}
              placeholder="Full prompt, constraints, or follow-ups (optional)"
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            />
          </div>
          <Button
            onClick={addGroupQuestion}
            className="w-full"
            disabled={!newQuestionTitle.trim() || !newSubjectId}
          >
            Add for Everyone
          </Button>
        </div>
      </Modal>
    </div>
  );
}
