"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPost, apiPut, getErrorMessage } from "@/lib/api";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PageHeader from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { GroupsPageSkeleton, ErrorState, EmptyState } from "@/components/ui/StateViews";
import InviteCodeBlock from "@/components/groups/InviteCodeBlock";
import { formatDate, isGroupFull, JOIN_CODE_TTL_MINUTES, MAX_GROUP_MEMBERS } from "@/lib/utils";
import toast from "react-hot-toast";
import { canManageGroup, isGroupAdminRole } from "@/lib/group-roles";
import type { Group, GroupRole } from "@/types";

type GroupListItem = Group & {
  memberCount: number;
  subjects: string[];
  myRole?: GroupRole | null;
};

export default function GroupsPage() {
  const { user, refreshUser } = useUser();
  const [groups, setGroups] = useState<GroupListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [generatingGroupId, setGeneratingGroupId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!user?._id) return;
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const data = await apiGet<GroupListItem[]>("/api/groups");
      setGroups(data);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load groups"));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [user?._id]);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async () => {
    if (joinCode.length !== 6 || !user) return;
    try {
      await apiPut("/api/groups/join", { code: joinCode });
      toast.success("Joined group!");
      setShowJoin(false);
      setJoinCode("");
      await refreshUser();
      load({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to join"));
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      await apiPost("/api/groups", {
        name: createName.trim(),
        description: createDescription.trim() || undefined,
      });
      toast.success("Group created!");
      setShowCreate(false);
      setCreateName("");
      setCreateDescription("");
      await refreshUser();
      load({ silent: true });
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create group"));
    } finally {
      setCreating(false);
    }
  };

  const generateInviteForGroup = async (groupId: string, opts?: { force?: boolean }) => {
    setGeneratingGroupId(groupId);
    try {
      const res = await apiPost<{ joinCode: string; joinCodeExpiresAt: string }>(
        `/api/groups/${groupId}/regenerate-code`,
        opts?.force ? { force: true } : {}
      );
      setGroups((prev) =>
        prev.map((g) =>
          g._id === groupId
            ? { ...g, joinCode: res.joinCode, joinCodeExpiresAt: res.joinCodeExpiresAt }
            : g
        )
      );
      toast.success("Invite code ready to share");
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to generate invite code"));
    } finally {
      setGeneratingGroupId(null);
    }
  };

  if (loading) return <GroupsPageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={() => setShowJoin(true)}>
        Join Group
      </Button>
      <Button size="sm" onClick={() => setShowCreate(true)}>
        Create Group
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        description="Collaborate and stay accountable with your prep group."
        action={headerActions}
      />

      {groups.length === 0 ? (
        <EmptyState
          title="No groups yet"
          description="Create your own prep group or join one with an invite code."
          action={headerActions}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => {
            const isGroupAdmin = isGroupAdminRole(g.myRole);
            const canGenerateInvite = canManageGroup(g.myRole);
            const isActive = g._id === user?.activeGroupId;
            return (
              <article
                key={g._id}
                className={clsx(
                  "relative overflow-hidden rounded-xl bg-[var(--card)] p-5 shadow-soft transition-shadow hover:shadow-softHover",
                  isActive && "ring-1 ring-brand/25"
                )}
              >
                {isActive && (
                  <span
                    className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-brand"
                    aria-hidden
                  />
                )}
                <div className="flex items-start justify-between gap-3 pl-1">
                  <div className="min-w-0">
                    <Link
                      href={`/groups/${g._id}`}
                      className="text-lg font-semibold text-[var(--foreground)] hover:text-brand"
                    >
                      {g.name}
                    </Link>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {g.memberCount}/{MAX_GROUP_MEMBERS} members
                      {g.interviewDate ? ` · Interview ${formatDate(g.interviewDate)}` : ""}
                    </p>
                    {g.subjects.length > 0 && (
                      <p className="mt-2 text-xs text-[var(--muted)]">
                        {g.subjects.slice(0, 4).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {isGroupAdmin && (
                      <Chip variant="muted" className="!text-[10px]">
                        Admin
                      </Chip>
                    )}
                    {isActive && (
                      <Chip variant="brand" className="!text-[10px]">
                        Active
                      </Chip>
                    )}
                  </div>
                </div>

                {canGenerateInvite && !isGroupFull(g.memberCount) && (
                  <div
                    className="mt-4 flex flex-wrap items-center gap-2 border-t border-[color-mix(in_srgb,var(--border)_50%,transparent)] pt-4 pl-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-[var(--muted)]">Invite</span>
                    <InviteCodeBlock
                      joinCode={g.joinCode}
                      joinCodeExpiresAt={g.joinCodeExpiresAt}
                      onGenerate={(opts) => generateInviteForGroup(g._id, opts)}
                      generating={generatingGroupId === g._id}
                      compact
                      inline
                    />
                  </div>
                )}

                {canGenerateInvite && isGroupFull(g.memberCount) && (
                  <p className="mt-4 border-t border-[color-mix(in_srgb,var(--border)_50%,transparent)] pt-4 pl-1 text-xs text-[var(--muted)]">
                    Group full ({MAX_GROUP_MEMBERS}/{MAX_GROUP_MEMBERS})
                  </p>
                )}

                <div className="mt-4 pl-1">
                  <Link
                    href={`/groups/${g._id}`}
                    className="text-sm font-medium text-brand hover:underline"
                  >
                    Open group →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Modal open={showJoin} onClose={() => setShowJoin(false)} title="Join Group">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Enter the invite code shared by your group admin. Groups are limited to {MAX_GROUP_MEMBERS}{" "}
            members. Codes expire after {JOIN_CODE_TTL_MINUTES} minutes.
          </p>
          <Input
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
            className="font-mono tracking-widest"
          />
          <Button onClick={handleJoin} className="w-full" disabled={joinCode.length !== 6}>
            Join Group
          </Button>
        </div>
      </Modal>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Group">
        <div className="space-y-4">
          <p className="text-sm text-[var(--muted)]">
            Set up a shared prep group. You can invite teammates later with a short-lived code.
          </p>
          <div>
            <label className="text-sm font-medium">Group name</label>
            <Input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={`${user?.name ?? "My"}'s Prep Group`}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <Input
              type="text"
              value={createDescription}
              onChange={(e) => setCreateDescription(e.target.value)}
              placeholder="e.g. FAANG switch prep squad"
              className="mt-1"
            />
          </div>
          <Button
            onClick={handleCreate}
            className="w-full"
            disabled={creating || !createName.trim()}
          >
            {creating ? "Creating…" : "Create Group"}
          </Button>
        </div>
      </Modal>

    </div>
  );
}
