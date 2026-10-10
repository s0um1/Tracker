"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPost, apiPatch, apiDelete, getErrorMessage } from "@/lib/api";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Modal from "@/components/ui/Modal";
import MotivationBanner from "@/components/dashboard/MotivationBanner";
import {
  QuestionsPageSkeleton,
  ErrorState,
  EmptyState,
} from "@/components/ui/StateViews";
import QuestionListView, { type QuestionListItem } from "@/components/questions/QuestionListView";
import {
  formatSubjectTrack,
  joinQuestionFields,
  splitQuestionFields,
  toDateInputValue,
  QUESTION_DATE_PERIODS,
  normalizeQuestionStatus,
  type QuestionDatePeriod,
  type QuestionSortField,
  type QuestionSortDir,
} from "@/lib/utils";
import toast from "react-hot-toast";
import {
  triggerQuestionPointsBurst,
  type QuestionPointBurst,
} from "@/lib/question-points-burst";
import { canManageGroup } from "@/lib/group-roles";
import type { ContentScope, GroupRole, PracticeQuestion, QuestionStatus, Subject } from "@/types";

type QuestionWithSubject = PracticeQuestion & { subjectName: string; trackLabel: string };

type PagedQuestions = {
  items: QuestionWithSubject[];
  total: number;
  page: number;
  limit: number;
};

const PAGE_SIZE = 10;

export default function QuestionsPage() {
  const { user } = useUser();
  const [questions, setQuestions] = useState<QuestionWithSubject[]>([]);
  const [pointBurst, setPointBurst] = useState<QuestionPointBurst | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [datePeriod, setDatePeriod] = useState<QuestionDatePeriod>("today");
  const [sortBy, setSortBy] = useState<QuestionSortField>("date");
  const [sortDir, setSortDir] = useState<QuestionSortDir>("desc");
  const [loading, setLoading] = useState(true);
  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [questionTitle, setQuestionTitle] = useState("");
  const [questionDescription, setQuestionDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [link, setLink] = useState("");
  const [practiceDate, setPracticeDate] = useState(toDateInputValue());
  const [scope, setScope] = useState<ContentScope>("group");
  const [canAddGroupQuestions, setCanAddGroupQuestions] = useState(false);

  const groupSubjects = useMemo(
    () => subjects.filter((s) => s.scope === "group"),
    [subjects]
  );
  const personalSubjects = useMemo(
    () => subjects.filter((s) => s.scope === "personal"),
    [subjects]
  );
  const modalSubjects = scope === "group" ? groupSubjects : personalSubjects;

  const activeGroupId = user?.activeGroupId;

  const load = useCallback(async () => {
    if (!activeGroupId) {
      setLoading(false);
      setInitialLoad(false);
      return;
    }
    setLoading(true);
    try {
      const questionUrl = `/api/practice-questions?groupId=${activeGroupId}&scope=all&page=${page}&limit=${PAGE_SIZE}&period=${datePeriod}&sortBy=${sortBy}&sortDir=${sortDir}`;

      const [questionData, subjectData, groupHeader] = await Promise.all([
        apiGet<PagedQuestions>(questionUrl),
        apiGet<Subject[]>(`/api/subjects?groupId=${activeGroupId}&minimal=1`),
        apiGet<{ myRole: GroupRole | null }>(
          `/api/groups/${activeGroupId}?view=header`
        ),
      ]);
      setQuestions(questionData.items);
      setTotal(questionData.total);
      setSubjects(subjectData);
      setCanAddGroupQuestions(canManageGroup(groupHeader.myRole));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [activeGroupId, page, datePeriod, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    document.getElementById("app-main")?.scrollTo({ top: 0 });
  }, [page]);

  useEffect(() => {
    const available = scope === "group" ? groupSubjects : personalSubjects;
    if (available.length > 0 && !available.some((s) => s._id === subjectId)) {
      setSubjectId(available[0]._id);
    }
  }, [scope, groupSubjects, personalSubjects, subjectId]);

  useEffect(() => {
    if (!canAddGroupQuestions && scope === "group") {
      setScope("personal");
    }
  }, [canAddGroupQuestions, scope]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleSort = (field: QuestionSortField) => {
    if (sortBy === field) {
      setSortDir((dir) => (dir === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(field === "date" ? "desc" : "asc");
    }
    setPage(1);
  };

  const resetForm = () => {
    setEditingId(null);
    setQuestionTitle("");
    setQuestionDescription("");
    setLink("");
    setPracticeDate(toDateInputValue());
    setScope(canAddGroupQuestions ? "group" : "personal");
    setSubjectId(
      (canAddGroupQuestions ? groupSubjects[0] : personalSubjects[0])?._id ??
        personalSubjects[0]?._id ??
        ""
    );
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (q: QuestionListItem) => {
    const full = questions.find((item) => item._id === q._id);
    if (!full) return;
    setEditingId(full._id);
    const parts = splitQuestionFields(full.content);
    setQuestionTitle(parts.title);
    setQuestionDescription(parts.description);
    setLink(full.link ?? "");
    setPracticeDate(toDateInputValue(full.practiceDate ?? full.createdAt));
    setScope(full.scope);
    setSubjectId(full.subjectId);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    resetForm();
  };

  const saveQuestion = async () => {
    if (!questionTitle.trim() || !subjectId || !user?.activeGroupId) return;
    const payload = {
      title: questionTitle.trim(),
      description: questionDescription.trim(),
      link: link.trim() || undefined,
      subjectId,
      practiceDate,
    };
    const mergedContent = joinQuestionFields(payload.title, payload.description);
    setSaving(true);
    try {
      if (editingId) {
        const updated = await apiPatch<QuestionWithSubject>(`/api/practice-questions/${editingId}`, payload);
        const subject = subjects.find((s) => s._id === subjectId);
        setQuestions((prev) =>
          prev.map((q) =>
            q._id === editingId
              ? {
                  ...q,
                  ...updated,
                  content: mergedContent,
                  link: payload.link,
                  subjectId,
                  practiceDate,
                  subjectName: subject?.name ?? q.subjectName,
                  trackLabel: subject ? formatSubjectTrack(subject) : q.trackLabel,
                }
              : q
          )
        );
        toast.success("Question updated");
      } else {
        await apiPost("/api/practice-questions", {
          groupId: user.activeGroupId,
          scope,
          ...payload,
        });
        toast.success("Question added");
        if (page !== 1) setPage(1);
        else load();
      }
      closeModal();
    } catch (err) {
      toast.error(getErrorMessage(err, editingId ? "Failed to update question" : "Failed to add question"));
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: QuestionStatus) => {
    const normalized = normalizeQuestionStatus(status);
    let previousStatus: QuestionStatus | undefined;
    setQuestions((prev) => {
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
      triggerQuestionPointsBurst(setPointBurst, id, updated.pointsEarnedNow);
      if (normalized === "add_to_todo") {
        toast.success("Added to Tasks");
      }
    } catch (err) {
      setQuestions((prev) =>
        prev.map((q) => (q._id === id ? { ...q, status: previousStatus! } : q))
      );
      toast.error(getErrorMessage(err, "Failed to update question"));
    }
  };

  const deleteQuestion = async (id: string) => {
    try {
      await apiDelete(`/api/practice-questions/${id}`);
      toast.success("Question deleted");
      const remainingOnPage = questions.length - 1;
      const newTotal = total - 1;
      const newTotalPages = Math.max(1, Math.ceil(newTotal / PAGE_SIZE));
      if (remainingOnPage === 0 && page > 1 && page > newTotalPages) {
        setPage(newTotalPages);
      } else {
        load();
      }
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to delete question"));
    }
  };

  if (user && !user.activeGroupId) {
    return (
      <EmptyState
        title="No active group"
        description="Join or create a group to start tracking practice questions."
        action={
          <Link href="/groups">
            <Button>Browse Groups</Button>
          </Link>
        }
      />
    );
  }

  if (initialLoad && loading) {
    return <QuestionsPageSkeleton />;
  }
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Questions</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {total} question{total === 1 ? "" : "s"} — track daily practice progress
          </p>
        </div>
        <Button size="sm" onClick={openCreateModal}>
          Add Question
        </Button>
      </div>

      <MotivationBanner />

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {QUESTION_DATE_PERIODS.map(({ id, label }) => (
            <Chip
              key={id}
              variant="brand"
              active={datePeriod === id}
              onClick={() => {
                setDatePeriod(id);
                setPage(1);
              }}
              className="!px-3 !py-1.5 !text-sm"
            >
              {label}
            </Chip>
          ))}
        </div>
      </div>

      {questions.length === 0 ? (
        <EmptyState
          title={datePeriod !== "all" ? "No matching questions" : "No questions yet"}
          description={
            datePeriod !== "all"
              ? "Try another period or add a question."
              : "Add practice questions to track your preparation."
          }
          action={<Button onClick={openCreateModal}>Add Question</Button>}
        />
      ) : (
        <>
          <QuestionListView
            questions={questions}
            onStatusChange={updateStatus}
            pointBurst={pointBurst}
            onEdit={openEditModal}
            onDelete={deleteQuestion}
            showScope
            showActions
            sortBy={sortBy}
            sortDir={sortDir}
            onSort={handleSort}
            loading={loading}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
              {datePeriod !== "all" ? ` · ${QUESTION_DATE_PERIODS.find((p) => p.id === datePeriod)?.label}` : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="px-2 text-sm text-[var(--muted)]">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingId ? "Edit Question" : "Add Question"}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0 flex-1">
              {!editingId ? (
                <>
                  <label className="text-sm font-medium">Visibility</label>
                  {canAddGroupQuestions ? (
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value as ContentScope)}
                      className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
                    >
                      <option value="group">Group — shared with everyone</option>
                      <option value="personal">Personal — only you</option>
                    </select>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      Personal — only you (group questions require admin or co-admin)
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-[var(--muted)] sm:pb-2">
                  {scope === "group"
                    ? "Group question — visible to everyone"
                    : "Personal question — only you"}
                </p>
              )}
            </div>
            <div className="w-full shrink-0 sm:w-[11.5rem]">
              <label className="text-sm font-medium">Practice date</label>
              <input
                type="date"
                value={practiceDate}
                onChange={(e) => setPracticeDate(e.target.value)}
                className="input-date-end mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
              />
            </div>
          </div>
          {(editingId ? subjects.filter((s) => s.scope === scope) : modalSubjects).length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              No {scope} subjects yet.{" "}
              <Link href="/subjects" className="text-brand hover:underline">Create one</Link> first.
            </p>
          ) : (
            <div>
              <label className="text-sm font-medium">Track</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
              >
                {(editingId ? subjects.filter((s) => s.scope === scope) : modalSubjects).map((s) => (
                  <option key={s._id} value={s._id}>
                    {formatSubjectTrack(s)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-sm font-medium">Title</label>
            <input
              type="text"
              value={questionTitle}
              onChange={(e) => setQuestionTitle(e.target.value)}
              placeholder="TCP vs UDP"
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={questionDescription}
              onChange={(e) => setQuestionDescription(e.target.value)}
              placeholder="Explain connection-oriented vs connectionless delivery, use cases, and trade-offs."
              rows={3}
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Link (optional)</label>
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            />
          </div>
          {!editingId && (
            <p className="text-xs text-[var(--muted)]">
              New questions start as <strong>Not Started</strong>. Use <strong>Add to do</strong> to queue one in Tasks.
            </p>
          )}
          <Button
            onClick={saveQuestion}
            className="w-full"
            disabled={
              saving ||
              !questionTitle.trim() ||
              !subjectId ||
              (editingId
                ? subjects.filter((s) => s.scope === scope).length === 0
                : modalSubjects.length === 0)
            }
          >
            {saving ? "Saving…" : editingId ? "Save Changes" : "Save Question"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
