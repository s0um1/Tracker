"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { CalendarDays, CheckCircle2, Clock, Users } from "lucide-react";
import { apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Chip from "@/components/ui/Chip";
import ProgressBar, { ReadinessRing } from "@/components/ui/ProgressBar";
import { MockInterviewsSkeleton, ErrorState } from "@/components/ui/StateViews";
import { formatDate, formatDateTime, parseAppDateTime, toDateTimeLocalValue } from "@/lib/utils";
import toast from "react-hot-toast";
import { canManageGroup } from "@/lib/group-roles";
import type { GroupRole, MockInterviewSchedule, MockInterviewScheduleMember } from "@/types";

const STATUS_LABEL: Record<MockInterviewScheduleMember["status"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

const STATUS_VARIANT: Record<
  MockInterviewScheduleMember["status"],
  "muted" | "warning" | "success"
> = {
  not_started: "muted",
  in_progress: "warning",
  completed: "success",
};

function roundTabLabel(round: MockInterviewSchedule["rounds"][number]) {
  if (round.interviewDate) return formatDate(round.interviewDate);
  if (round.isCurrent) return "Upcoming";
  return "No date";
}

const dateTimeInputClass =
  "input w-full max-w-[16rem] min-w-0 !rounded-md !px-2.5 !py-1.5 !text-sm input-date-end";

type ViewMode = "schedule" | "history";

function memberInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function ViewModeTabs({
  mode,
  onChange,
  historyCount,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
  historyCount: number;
}) {
  const tabs: { id: ViewMode; label: string }[] = [
    { id: "schedule", label: "Upcoming" },
    { id: "history", label: historyCount > 0 ? `Past (${historyCount})` : "Past" },
  ];

  return (
    <div className="flex rounded-lg bg-[var(--surface-muted)] p-0.5">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={clsx(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm",
            mode === tab.id
              ? "bg-[var(--card)] text-[var(--foreground)] shadow-soft"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/60 p-3">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <span className="text-brand">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-[var(--foreground)]">{value}</p>
      {hint ? <p className="mt-0.5 text-[11px] text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export default function GroupMockInterviewsTab({
  groupId,
  currentUserId,
}: {
  groupId: string;
  currentUserId?: string;
}) {
  const [schedule, setSchedule] = useState<MockInterviewSchedule | null>(null);
  const [activeRoundId, setActiveRoundId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [mockScore, setMockScore] = useState(70);
  const [mockWeaknesses, setMockWeaknesses] = useState("");
  const [submittingScore, setSubmittingScore] = useState(false);
  const [mockDate, setMockDate] = useState("");
  const [savingMockDate, setSavingMockDate] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("schedule");

  const load = useCallback(async (roundId?: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const query = roundId ? `&roundId=${roundId}` : "";
      const data = await apiGet<MockInterviewSchedule>(
        `/api/mock-interviews/schedule?groupId=${groupId}${query}`
      );
      setSchedule(data);
      if (!roundId || roundId === data.activeRoundId) {
        setActiveRoundId(data.activeRoundId);
      }
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load mock interviews"));
      if (!silent) setSchedule(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [groupId]);

  const patchRoundAndMemberDates = (scheduledAt: string) => {
    setSchedule((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rounds: prev.rounds.map((r) =>
          r._id === prev.activeRoundId ? { ...r, interviewDate: scheduledAt } : r
        ),
        members: prev.members.map((m) => ({ ...m, scheduledAt })),
      };
    });
  };

  useEffect(() => {
    load(activeRoundId || undefined);
  }, [load, activeRoundId]);

  const selected = schedule?.members.find((m) => m.userId === selectedId) ?? null;
  const activeRound = schedule?.rounds.find((r) => r._id === schedule.activeRoundId);
  const isHistory = viewMode === "history" || (schedule?.isViewingHistory ?? false);
  const pastRounds = schedule?.rounds.filter((r) => !r.isCurrent) ?? [];

  const switchViewMode = (mode: ViewMode) => {
    setViewMode(mode);
    if (!schedule) return;
    if (mode === "schedule" && schedule.currentRoundId) {
      setActiveRoundId(schedule.currentRoundId);
    } else if (mode === "history" && pastRounds.length > 0) {
      setActiveRoundId(pastRounds[pastRounds.length - 1]._id);
    }
  };

  const myRole = schedule?.members.find((m) => m.userId === currentUserId)?.role as GroupRole | undefined;
  const canManage = canManageGroup(myRole);
  const isSelf = selectedId === currentUserId;
  const canGenerate =
    canManage &&
    schedule?.canGenerate &&
    !isHistory &&
    selected &&
    !selected.session &&
    !isSelf &&
    currentUserId;
  const canScore =
    !isHistory &&
    selected?.session &&
    currentUserId &&
    !isSelf &&
    !selected.session.currentUserHasScored;

  const generateQuestions = async () => {
    if (!currentUserId || !selectedId || !schedule) return;
    setGenerating(true);
    try {
      const data = await apiPost<{
        intervieweeName: string;
        questions: unknown[];
      }>("/api/mock-interviews/generate", {
        intervieweeId: selectedId,
        groupId,
        roundId: schedule.activeRoundId,
      });
      toast.success(
        `Picked ${data.questions.length} done questions for ${data.intervieweeName}`
      );
      await load(schedule.activeRoundId);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to generate questions"));
    } finally {
      setGenerating(false);
    }
  };

  const openScheduleModal = () => {
    setMockDate(
      activeRound?.interviewDate ? toDateTimeLocalValue(activeRound.interviewDate) : ""
    );
    setShowScheduleModal(true);
  };

  const saveMockDate = async () => {
    if (!schedule || !mockDate) return;
    setSavingMockDate(true);
    try {
      const data = await apiPatch<{ scheduledAt: string }>("/api/mock-interviews/schedule", {
        action: "setMockDate",
        groupId,
        roundId: schedule.activeRoundId,
        scheduledAt: parseAppDateTime(mockDate).toISOString(),
      });
      patchRoundAndMemberDates(data.scheduledAt);
      toast.success("Group mock date saved");
      setShowScheduleModal(false);
      void load(schedule.activeRoundId, true);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save mock date"));
    } finally {
      setSavingMockDate(false);
    }
  };

  const submitMockScore = async () => {
    if (!currentUserId || !selected?.session) return;
    setSubmittingScore(true);
    try {
      await apiPost("/api/mock-interviews", {
        sessionId: selected.session._id,
        intervieweeId: selectedId,
        groupId,
        score: mockScore,
        weaknesses: mockWeaknesses.split(",").map((s) => s.trim()).filter(Boolean),
        strengths: [],
      });
      toast.success("Your score has been submitted");
      setShowLogModal(false);
      setMockWeaknesses("");
      setMockScore(70);
      await load(schedule?.activeRoundId);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to submit score"));
    } finally {
      setSubmittingScore(false);
    }
  };

  if (loading && !schedule) return <MockInterviewsSkeleton />;
  if (error && !schedule) return <ErrorState message={error} onRetry={() => load()} />;
  if (!schedule) return <ErrorState message="Schedule not found" onRetry={() => load()} />;

  const memberTotal = schedule.members.length;
  const completedCount = schedule.members.filter((m) => m.status === "completed").length;
  const inProgressCount = schedule.members.filter((m) => m.status === "in_progress").length;
  const completionPct =
    memberTotal > 0 ? Math.round((completedCount / memberTotal) * 100) : 0;
  const scoredMembers = schedule.members.filter((m) => m.averageScore !== null);
  const groupAvgScore =
    scoredMembers.length > 0
      ? Math.round(
          scoredMembers.reduce((sum, m) => sum + (m.averageScore ?? 0), 0) / scoredMembers.length
        )
      : null;
  const currentRoundHasDate = Boolean(activeRound?.interviewDate);
  const isMockToday = schedule.canGenerate;
  const roundDateLabel = activeRound?.interviewDate
    ? formatDateTime(activeRound.interviewDate)
    : "Not scheduled";

  const showRoster = viewMode === "schedule" || pastRounds.length > 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Mock interviews"
          subtitle={
            viewMode === "history"
              ? "Past rounds, questions, and peer scores"
              : "One group mock date — generate questions and score peers"
          }
          action={
            <ViewModeTabs
              mode={viewMode}
              onChange={switchViewMode}
              historyCount={pastRounds.length}
            />
          }
        />

        {viewMode === "history" && pastRounds.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/40 px-4 py-8 text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">No past mocks yet</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Older rounds show up here when your group has run mocks before.
            </p>
          </div>
        ) : (
          <>
            <div
              className="mb-5 rounded-2xl border border-[var(--border)] p-4 sm:p-5"
              style={{
                background:
                  "linear-gradient(135deg, color-mix(in srgb, var(--brand) 8%, var(--card)) 0%, var(--card) 55%)",
              }}
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <ReadinessRing value={completionPct} size={88} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {viewMode === "history" ? "Past round" : "Upcoming round"}
                    </p>
                    <p className="mt-0.5 text-lg font-bold text-[var(--foreground)] sm:text-xl">
                      {roundDateLabel}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {completedCount} of {memberTotal} completed
                      {inProgressCount > 0 ? ` · ${inProgressCount} in progress` : ""}
                    </p>
                    <div className="mt-3 max-w-xs">
                      <ProgressBar value={completionPct} size="sm" />
                    </div>
                  </div>
                </div>

                {viewMode === "schedule" && canManage && (
                  <Button size="sm" variant="outline" onClick={openScheduleModal}>
                    {currentRoundHasDate ? "Edit group mock date" : "Set group mock date"}
                  </Button>
                )}
              </div>

              {viewMode === "history" && pastRounds.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
                  {pastRounds.map((round) => (
                    <Chip
                      key={round._id}
                      variant="brand"
                      active={schedule.activeRoundId === round._id}
                      onClick={() => setActiveRoundId(round._id)}
                      className="!px-3 !py-1.5 !text-sm"
                    >
                      {roundTabLabel(round)}
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                icon={<CalendarDays className="h-3.5 w-3.5" aria-hidden />}
                label="Mock day"
                value={
                  isHistory
                    ? activeRound?.interviewDate
                      ? formatDate(activeRound.interviewDate)
                      : "—"
                    : isMockToday
                      ? "Today"
                      : currentRoundHasDate
                        ? formatDate(activeRound!.interviewDate!)
                        : "TBD"
                }
                hint={!isHistory && isMockToday ? "You can generate questions" : undefined}
              />
              <StatTile
                icon={<Users className="h-3.5 w-3.5" aria-hidden />}
                label="Team"
                value={`${memberTotal} members`}
                hint={`${completedCount} finished this round`}
              />
              <StatTile
                icon={<CheckCircle2 className="h-3.5 w-3.5" aria-hidden />}
                label="Completion"
                value={`${completionPct}%`}
                hint={`${completedCount}/${memberTotal} done`}
              />
              <StatTile
                icon={<Clock className="h-3.5 w-3.5" aria-hidden />}
                label="Avg score"
                value={groupAvgScore !== null ? `${groupAvgScore}/100` : "—"}
                hint={
                  scoredMembers.length > 0
                    ? `From ${scoredMembers.length} scored`
                    : "No scores yet"
                }
              />
            </div>
          </>
        )}

        {showRoster && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)]">
              <div className="border-b border-[var(--border)] bg-[var(--surface-muted)]/50 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Team roster
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] text-sm">
                  <thead>
                    <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-3 py-2.5">Member</th>
                      <th className="px-3 py-2.5">Done</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="hidden px-3 py-2.5 md:table-cell">Mock Qs</th>
                      <th className="hidden px-3 py-2.5 sm:table-cell">Scores</th>
                      <th className="px-3 py-2.5 text-right">Avg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.members.map((member) => {
                      const isSelected = selectedId === member.userId;
                      return (
                        <tr
                          key={member.userId}
                          className={clsx(
                            "cursor-pointer border-t border-[var(--border)] transition-colors",
                            isSelected
                              ? "bg-brand/8"
                              : "hover:bg-[var(--surface-muted)]/60"
                          )}
                          onClick={() => setSelectedId(member.userId)}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-bold text-brand"
                                aria-hidden
                              >
                                {memberInitials(member.name)}
                              </span>
                              <Link
                                href={`/users/${member.userId}`}
                                className="min-w-0 font-medium text-brand hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="line-clamp-1">
                                  {member.name}
                                  {member.userId === currentUserId ? " (you)" : ""}
                                </span>
                              </Link>
                            </div>
                          </td>
                          <td className="px-3 py-3 font-medium tabular-nums">
                            {member.questionsDone}
                          </td>
                          <td className="px-3 py-3">
                            <Chip variant={STATUS_VARIANT[member.status]} className="!text-[10px]">
                              {STATUS_LABEL[member.status]}
                            </Chip>
                          </td>
                          <td className="hidden px-3 py-3 text-[var(--muted)] md:table-cell">
                            {member.questionCount > 0 ? member.questionCount : "—"}
                          </td>
                          <td className="hidden px-3 py-3 text-[var(--muted)] sm:table-cell">
                            {member.session
                              ? `${member.scoresSubmitted}/${member.scoresExpected}`
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums text-brand">
                            {member.averageScore !== null ? member.averageScore : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
              {selected ? (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]/30 p-4">
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-bold text-brand"
                      aria-hidden
                    >
                      {memberInitials(selected.name)}
                    </span>
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--foreground)]">{selected.name}</p>
                      <p className="mt-0.5 text-xs text-[var(--muted)]">
                        {selected.session
                          ? `Generated ${formatDate(selected.session.createdAt)}`
                          : activeRound?.interviewDate
                            ? `Group mock · ${formatDateTime(activeRound.interviewDate)}`
                            : "No group mock date set"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="rounded-lg bg-[var(--card)] px-3 py-2.5 text-sm text-[var(--muted)]">
                      <span className="font-semibold text-[var(--foreground)]">
                        {selected.questionsDone}
                      </span>{" "}
                      done questions
                      {!isHistory && " · pool for mock picks"}
                    </div>

                    {canGenerate ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={generateQuestions}
                        disabled={generating}
                      >
                        {generating ? "Picking…" : "Generate from done questions"}
                      </Button>
                    ) : null}

                    {!isHistory &&
                      !isMockToday &&
                      activeRound?.interviewDate &&
                      !selected.session &&
                      !isSelf && (
                        <p className="text-xs text-[var(--muted)]">
                          Generation opens on {formatDate(activeRound.interviewDate)}.
                        </p>
                      )}

                    {isSelf && !selected.session && !isHistory && (
                      <p className="text-xs text-[var(--muted)]">
                        A teammate generates your mock from your done list.
                      </p>
                    )}

                    {selected.session ? (
                      <>
                        <div className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            Mock questions
                          </p>
                          {selected.session.questions.map((q) => (
                            <div
                              key={`${q.subjectId}-${q.questionId ?? q.question}`}
                              className="inset-panel p-3"
                            >
                              <p className="text-[10px] font-semibold uppercase text-brand">
                                {q.subjectName}
                              </p>
                              <p className="mt-1 text-sm font-medium leading-snug">{q.question}</p>
                            </div>
                          ))}
                        </div>

                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                            Peer scores
                          </p>
                          <div className="mt-2 space-y-1.5">
                            {selected.session.expectedScorers.map((scorerId) => {
                              const scorer = schedule.members.find((m) => m.userId === scorerId);
                              const submitted = selected.session!.scores.find(
                                (s) => s.interviewerId === scorerId
                              );
                              return (
                                <div
                                  key={scorerId}
                                  className="flex items-center justify-between rounded-lg bg-[var(--card)] px-3 py-2 text-sm"
                                >
                                  <span className="truncate">{scorer?.name ?? "Member"}</span>
                                  {submitted ? (
                                    <span className="font-semibold text-emerald-600">
                                      {submitted.score}
                                    </span>
                                  ) : (
                                    <span className="text-[var(--muted)]">Pending</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {canScore ? (
                          <Button size="sm" className="w-full" onClick={() => setShowLogModal(true)}>
                            Submit my score
                          </Button>
                        ) : null}
                        {selected.session.currentUserHasScored ? (
                          <p className="text-center text-xs text-emerald-600">
                            You submitted your score.
                          </p>
                        ) : null}
                      </>
                    ) : isHistory ? (
                      <p className="text-sm text-[var(--muted)]">
                        {selected.status === "not_started"
                          ? "No mock on this date."
                          : "No session data for this member."}
                      </p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center">
                  <p className="text-sm font-medium text-[var(--foreground)]">Select a member</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {viewMode === "history"
                      ? "View questions and scores for that round."
                      : "Generate questions or submit scores."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <Modal
        open={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        title="Group mock date"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            One date and time for the whole group. Everyone uses this slot for question generation
            on mock day.
          </p>
          <div>
            <label className="text-xs font-medium text-[var(--foreground)]">Date & time (IST)</label>
            <input
              type="datetime-local"
              value={mockDate}
              onChange={(e) => setMockDate(e.target.value)}
              className={`mt-1 ${dateTimeInputClass}`}
            />
          </div>
          <div className="flex justify-end gap-2 pt-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowScheduleModal(false)}
              disabled={savingMockDate}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void saveMockDate()}
              disabled={savingMockDate || !mockDate}
            >
              {savingMockDate ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={showLogModal}
        onClose={() => setShowLogModal(false)}
        title="Submit Mock Score"
        size="sm"
      >
        <div className="space-y-3">
          <p className="text-xs text-[var(--muted)]">
            Score {selected?.name}&apos;s mock. One score per member.
          </p>
          <div>
            <label className="text-xs font-medium">Score (0-100)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={mockScore}
              onChange={(e) => setMockScore(Number(e.target.value))}
              onWheel={(e) => e.currentTarget.blur()}
              className="input mt-1 max-w-[8rem] !py-1.5 !text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Weak areas (comma separated)</label>
            <input
              type="text"
              value={mockWeaknesses}
              onChange={(e) => setMockWeaknesses(e.target.value)}
              placeholder="Multithreading, SQL joins"
              className="input mt-1 !py-1.5 !text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={submitMockScore} disabled={submittingScore}>
              {submittingScore ? "Submitting…" : "Submit score"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
