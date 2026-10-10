"use client";

import { useEffect, useState, useCallback } from "react";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPost, apiPatch, getErrorMessage } from "@/lib/api";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { SubjectsGridSkeleton, SubjectsPageSkeleton, ErrorState, EmptyState } from "@/components/ui/StateViews";
import ProgressBar from "@/components/ui/ProgressBar";
import { ConfidenceBadge } from "@/components/ui/Badge";
import { formatSubjectTrack } from "@/lib/utils";
import toast from "react-hot-toast";
import type { ContentScope, SubjectWithStats } from "@/types";

export default function SubjectsPage() {
  const { user } = useUser();
  const [subjects, setSubjects] = useState<SubjectWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<ContentScope>("group");
  const [showModal, setShowModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectWithStats | null>(null);
  const [newName, setNewName] = useState("");
  const [newTotalQuestions, setNewTotalQuestions] = useState("");
  const [useForMockInterview, setUseForMockInterview] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!user?.activeGroupId && tab === "group") {
      setLoading(false);
      setSubjects([]);
      return;
    }
    setLoading(true);
    try {
      const url =
        tab === "group"
          ? `/api/subjects?groupId=${user!.activeGroupId}&scope=group`
          : `/api/subjects?scope=personal`;
      const data = await apiGet<SubjectWithStats[]>(url);
      setSubjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subjects");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [user, tab]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setNewName("");
    setNewTotalQuestions("");
    setUseForMockInterview(true);
    setEditingSubject(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (subject: SubjectWithStats) => {
    setEditingSubject(subject);
    setNewName(subject.name);
    setNewTotalQuestions(subject.totalQuestions ? String(subject.totalQuestions) : "");
    setUseForMockInterview(subject.useForMockInterview !== false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const createSubject = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/subjects", {
        ...(tab === "group" ? { groupId: user?.activeGroupId } : {}),
        name: newName,
        scope: tab,
        ...(newTotalQuestions ? { totalQuestions: Number(newTotalQuestions) } : {}),
        ...(tab === "group" ? { useForMockInterview } : {}),
      });
      toast.success(tab === "group" ? "Group track created" : "Personal track created");
      closeModal();
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create subject"));
    } finally {
      setSaving(false);
    }
  };

  const saveSubject = async () => {
    if (!editingSubject || !newName.trim()) return;
    const totalQuestions = newTotalQuestions ? Number(newTotalQuestions) : 0;
    if (!Number.isFinite(totalQuestions) || totalQuestions < 0) {
      toast.error("Enter a valid target count");
      return;
    }
    setSaving(true);
    try {
      const updated = await apiPatch<SubjectWithStats>(`/api/subjects/${editingSubject._id}`, {
        name: newName.trim(),
        totalQuestions,
        ...(tab === "group" ? { useForMockInterview } : {}),
      });
      setSubjects((prev) =>
        prev.map((s) =>
          s._id === editingSubject._id
            ? {
                ...s,
                ...updated,
                name: newName.trim(),
                totalQuestions,
                completionPercent:
                  totalQuestions > 0
                    ? Math.min(100, Math.round((s.questionCount / totalQuestions) * 100))
                    : 0,
              }
            : s
        )
      );
      toast.success("Track updated");
      closeModal();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update track"));
    } finally {
      setSaving(false);
    }
  };

  if (initialLoad && loading) {
    return <SubjectsPageSkeleton />;
  }

  if (error && subjects.length === 0) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Tracks</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {tab === "group"
              ? "Shared tracks for your group’s question bank."
              : "Your private tracks for solo practice."}
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal}>
          Add {tab === "group" ? "Group" : "Personal"} Track
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["group", "personal"] as ContentScope[]).map((scope) => (
          <Chip
            key={scope}
            variant="brand"
            active={tab === scope}
            onClick={() => setTab(scope)}
            className="!px-4 !py-1.5 !text-sm"
          >
            {scope === "group" ? "Group Tracks" : "My Tracks"}
          </Chip>
        ))}
      </div>

      {loading ? (
        <SubjectsGridSkeleton />
      ) : subjects.length === 0 ? (
        <EmptyState
          title={tab === "group" ? "No group tracks yet" : "No personal tracks yet"}
          description={
            tab === "group"
              ? "Add a track for your group to organize questions."
              : "Add personal tracks for your question bank."
          }
          action={<Button onClick={openCreateModal}>Add Track</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {subjects.map((s) => (
            <Card key={s._id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      {formatSubjectTrack(s)}
                    </h3>
                    <ConfidenceBadge confidence={s.confidence} />
                  </div>
                  <ProgressBar value={s.completionPercent} className="mt-3" />
                  <p className="mt-1.5 text-xs text-[var(--muted)]">
                    {s.questionCount}
                    {s.totalQuestions > 0 ? ` / ${s.totalQuestions}` : ""} questions ·{" "}
                    {s.completionPercent}% prepared
                  </p>
                  {tab === "group" && (
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {s.useForMockInterview !== false
                        ? "Included in mock interviews"
                        : "Excluded from mock interviews"}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => openEditModal(s)}>
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={showModal}
        onClose={closeModal}
        title={
          editingSubject
            ? `Edit ${tab === "group" ? "Group" : "Personal"} Track`
            : tab === "group"
              ? "Add Group Track"
              : "Add Personal Track"
        }
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Track name</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Track name"
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Target count</label>
            <input
              type="number"
              min={0}
              value={newTotalQuestions}
              onChange={(e) => setNewTotalQuestions(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="Target count (optional)"
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            />
          </div>
          {tab === "group" && (
            <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3 text-sm">
              <input
                type="checkbox"
                checked={useForMockInterview}
                onChange={(e) => setUseForMockInterview(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-[var(--foreground)]">Use for mock interviews</span>
                <span className="mt-0.5 block text-[var(--muted)]">
                  When enabled, one done question from this track can be picked per member mock.
                </span>
              </span>
            </label>
          )}
          <Button
            onClick={editingSubject ? saveSubject : createSubject}
            className="w-full"
            disabled={saving || !newName.trim()}
          >
            {saving ? "Saving…" : editingSubject ? "Save Changes" : "Save Track"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
