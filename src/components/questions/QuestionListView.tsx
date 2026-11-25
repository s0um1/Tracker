"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronUp, ExternalLink, Eye } from "lucide-react";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import { LoadingOverlay, QuestionRowsSkeleton } from "@/components/ui/StateViews";
import dynamic from "next/dynamic";

const QuestionPreviewModal = dynamic(() => import("@/components/questions/QuestionPreviewModal"), { ssr: false });
import QuestionPointsBurst from "@/components/questions/QuestionPointsBurst";
import QuestionScopeChip from "@/components/questions/QuestionScopeChip";
import QuestionStatusSelect from "@/components/questions/QuestionStatusSelect";
import type { QuestionPointBurst } from "@/lib/question-points-burst";
import { useConfirm } from "@/components/providers/ConfirmProvider";
import {
  normalizeQuestionStatus,
  DEFAULT_QUESTION_TABLE_SORT,
  formatDate,
  questionMatchesSearch,
  questionRowVars,
  splitQuestionFields,
  type QuestionSortDir,
  type QuestionSortField,
} from "@/lib/utils";
import type { ContentScope, QuestionStatus } from "@/types";

export type QuestionListItem = {
  _id: string;
  content: string;
  status: QuestionStatus;
  practiceDate?: string;
  createdAt?: string;
  trackLabel?: string;
  subjectName?: string;
  link?: string;
  scope?: ContentScope;
  /** Which group a shared question belongs to (shown when the person is in several groups). */
  groupName?: string;
  /** Scheduled before today and still unsolved: the row is highlighted. */
  overdueDays?: number;
};

/** Done and Revised both count as solved. */
function isSolved(status: QuestionListItem["status"]): boolean {
  const s = normalizeQuestionStatus(status);
  return s === "done" || s === "revised";
}

function OverdueTag({ days }: { days: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">
      Overdue {days}d
    </span>
  );
}

function questionDateLabel(q: QuestionListItem): string {
  return q.practiceDate ? formatDate(q.practiceDate) : "Unscheduled";
}

function QuestionLinkCell({ link }: { link?: string }) {
  if (!link?.trim()) {
    return <span className="text-[var(--muted)]">—</span>;
  }
  const href = link.trim();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Open resource link"
      title={href}
      className="inline-flex rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-brand"
      onClick={(e) => e.stopPropagation()}
    >
      <ExternalLink className="h-4 w-4" aria-hidden />
    </a>
  );
}

function SortableHeader({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  field: QuestionSortField;
  sortBy?: QuestionSortField;
  sortDir?: QuestionSortDir;
  onSort?: (field: QuestionSortField) => void;
  className?: string;
}) {
  if (!onSort) {
    return <th scope="col" className={className}>{label}</th>;
  }
  const active = sortBy === field;
  return (
    <th
      scope="col"
      className={className}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={clsx(
          "inline-flex items-center gap-1 font-semibold uppercase tracking-wide transition-colors",
          active ? "text-[var(--foreground)]" : "hover:text-[var(--foreground)]"
        )}
      >
        {label}
        {active &&
          (sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          ))}
      </button>
    </th>
  );
}

export default function QuestionListView({
  questions,
  onStatusChange,
  onEdit,
  onDelete,
  showScope = false,
  showGroup = false,
  showActions = false,
  sortBy,
  sortDir,
  onSort,
  loading = false,
  pointBurst = null,
  localSearch = "",
}: {
  questions: QuestionListItem[];
  onStatusChange: (id: string, status: QuestionStatus) => void;
  pointBurst?: QuestionPointBurst | null;
  onEdit?: (question: QuestionListItem) => void;
  onDelete?: (id: string) => void;
  showScope?: boolean;
  /** Adds a Group column; use it when shared questions come from more than one group. */
  showGroup?: boolean;
  showActions?: boolean;
  sortBy?: QuestionSortField;
  sortDir?: QuestionSortDir;
  onSort?: (field: QuestionSortField) => void;
  loading?: boolean;
  /** Client-side filter on the current rows (title or track). */
  localSearch?: string;
}) {
  const activeSortBy = sortBy ?? DEFAULT_QUESTION_TABLE_SORT.sortBy;
  const activeSortDir = sortDir ?? DEFAULT_QUESTION_TABLE_SORT.sortDir;

  const visibleQuestions = useMemo(() => {
    if (!localSearch.trim()) return questions;
    return questions.filter((q) => questionMatchesSearch(q, localSearch));
  }, [questions, localSearch]);

  const questionCol = "min-w-[12rem]";
  const scopeCol = "w-24";
  const statusCol = "w-40";
  const dateCol = "w-32";
  const trackCol = "w-28";
  const linkCol = "w-14";
  const viewCol = "w-14";
  const actionsCol = "w-1";
  const [preview, setPreview] = useState<QuestionListItem | null>(null);
  const confirm = useConfirm();
  const tableColSpan =
    6 + (showScope ? 1 : 0) + (showGroup ? 1 : 0) + (showActions ? 1 : 0);

  const handleDelete = async (q: QuestionListItem) => {
    if (!onDelete) return;
    const title = splitQuestionFields(q.content).title;
    const ok = await confirm({
      title: "Delete question?",
      message: `Delete "${title}"? This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;
    onDelete(q._id);
  };

  return (
    <>
      <div className={clsx("relative min-h-32 space-y-3 lg:hidden")}>
        {loading && questions.length > 0 && <LoadingOverlay label="Loading questions" />}
        {loading && questions.length === 0 ? <QuestionRowsSkeleton /> : null}
        {!loading && visibleQuestions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No questions match your search.</p>
        ) : null}
        {visibleQuestions.map((q) => (
          <div
            key={q._id}
            style={questionRowVars(q.status)}
            className={clsx(
              "question-row-card rounded-xl border border-[var(--border)] p-4",
              pointBurst?.id === q._id && "question-row-points-flash"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <Checkbox
                checked={isSolved(q.status)}
                onChange={() => onStatusChange(q._id, isSolved(q.status) ? "not_started" : "done")}
                aria-label={`Mark "${splitQuestionFields(q.content).title}" ${isSolved(q.status) ? "not done" : "done"}`}
                className="mt-0.5"
              />
              <p className="min-w-0 flex-1 text-sm font-medium line-clamp-2 text-[var(--foreground)]">
                {splitQuestionFields(q.content).title}
              </p>
              <div className="flex shrink-0 items-start gap-1">
                <button
                  type="button"
                  aria-label="View question"
                  onClick={() => setPreview(q)}
                  className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-brand"
                >
                  <Eye className="h-4 w-4" aria-hidden />
                </button>
              <div className="relative">
                {pointBurst?.id === q._id && <QuestionPointsBurst points={pointBurst.points} />}
                <QuestionStatusSelect
                  value={q.status}
                  onChange={(status) => onStatusChange(q._id, status)}
                  className="shrink-0"
                />
              </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
              {showScope && q.scope && <QuestionScopeChip scope={q.scope} />}
              {showGroup && q.groupName && (
                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{q.groupName}</span>
              )}
              {q.overdueDays ? <OverdueTag days={q.overdueDays} /> : null}
              <span className={q.overdueDays ? "font-medium text-red-700 dark:text-red-300" : undefined}>{questionDateLabel(q)}</span>
              <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5">
                {q.trackLabel || q.subjectName}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-[var(--foreground)]">Link</span>
                <QuestionLinkCell link={q.link} />
              </span>
            </div>
            {showActions && (onEdit || onDelete) && (
              <div className="mt-3 flex justify-end gap-1">
                {onEdit && (
                  <Button variant="ghost" size="sm" onClick={() => onEdit(q)}>
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(q)}>
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className={clsx(
          "relative hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] lg:block"
        )}
      >
        {loading && questions.length > 0 && <LoadingOverlay label="Loading questions" />}
        <div className="overflow-x-auto px-1 pb-1">
        <table className="w-full border-separate border-spacing-y-1 text-left text-sm">
          <caption className="sr-only">Practice questions</caption>
          <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th scope="col" className={`${questionCol} px-3 py-3 font-semibold`}>Question</th>
              {showScope && (
                <SortableHeader
                  label="Scope"
                  field="scope"
                  sortBy={activeSortBy}
                  sortDir={activeSortDir}
                  onSort={onSort}
                  className={`${scopeCol} px-3 py-3`}
                />
              )}
              {showGroup && (
                <th scope="col" className="min-w-[7rem] px-3 py-3 font-semibold">
                  Group
                </th>
              )}
              <SortableHeader
                label="Status"
                field="status"
                sortBy={activeSortBy}
                sortDir={activeSortDir}
                onSort={onSort}
                className={`${statusCol} px-3 py-3`}
              />
              <SortableHeader
                label="Date"
                field="date"
                sortBy={activeSortBy}
                sortDir={activeSortDir}
                onSort={onSort}
                className={`${dateCol} px-3 py-3`}
              />
              <SortableHeader
                label="Track"
                field="track"
                sortBy={activeSortBy}
                sortDir={activeSortDir}
                onSort={onSort}
                className={`${trackCol} px-3 py-3`}
              />
              <th scope="col" className={`${linkCol} px-2 py-3 font-semibold`}>Link</th>
              <th scope="col" className={`${viewCol} px-2 py-3 font-semibold`}>View</th>
              {showActions && (
                <th scope="col" className={`${actionsCol} px-3 py-3 font-semibold`}>Actions</th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && questions.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="p-0">
                  <QuestionRowsSkeleton />
                </td>
              </tr>
            ) : null}
            {!loading && visibleQuestions.length === 0 ? (
              <tr>
                <td colSpan={tableColSpan} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  No questions match your search.
                </td>
              </tr>
            ) : null}
            {visibleQuestions.map((q) => (
              <tr
                key={q._id}
                className={clsx(
                  "question-row",
                  pointBurst?.id === q._id && "question-row-points-flash"
                )}
                style={questionRowVars(q.status)}
              >
                <td className="qs-row-cell px-3 py-3.5 text-[var(--foreground)]">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={isSolved(q.status)}
                      onChange={() => onStatusChange(q._id, isSolved(q.status) ? "not_started" : "done")}
                      aria-label={`Mark "${splitQuestionFields(q.content).title}" ${isSolved(q.status) ? "not done" : "done"}`}
                      className="mt-0.5"
                    />
                    <p className="line-clamp-2 font-medium">{splitQuestionFields(q.content).title}</p>
                  </div>
                </td>
                {showScope && (
                  <td className="qs-row-cell px-3 py-3.5">
                    {q.scope ? <QuestionScopeChip scope={q.scope} /> : "—"}
                  </td>
                )}
                {showGroup && (
                  <td className="qs-row-cell px-3 py-3.5">
                    {q.groupName ? (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs font-semibold text-brand">{q.groupName}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
                <td className={`qs-row-cell ${statusCol} px-3 py-3.5`}>
                  <div className="relative inline-block min-w-[8.5rem]">
                    {pointBurst?.id === q._id && (
                      <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2">
                        <QuestionPointsBurst points={pointBurst.points} />
                      </div>
                    )}
                    <QuestionStatusSelect
                      value={q.status}
                      onChange={(status) => onStatusChange(q._id, status)}
                      className="relative z-0 w-full"
                    />
                  </div>
                </td>
                <td className={`qs-row-cell whitespace-nowrap px-3 py-3.5 text-[var(--muted)] ${dateCol}`}>
                  {q.overdueDays ? <span className="mr-2"><OverdueTag days={q.overdueDays} /></span> : null}
                  <span className={q.overdueDays ? "font-medium text-red-700 dark:text-red-300" : undefined}>{questionDateLabel(q)}</span>
                </td>
                <td className={`qs-row-cell whitespace-nowrap px-3 py-3.5 ${trackCol}`}>
                  <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    {q.trackLabel || q.subjectName}
                  </span>
                </td>
                <td className={`qs-row-cell px-2 py-3.5 text-center ${linkCol}`}>
                  <QuestionLinkCell link={q.link} />
                </td>
                <td className={`qs-row-cell px-2 py-3.5 text-center ${viewCol}`}>
                  <button
                    type="button"
                    aria-label="View question"
                    onClick={() => setPreview(q)}
                    className="rounded-lg p-1.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-muted)] hover:text-brand"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                  </button>
                </td>
                {showActions && (
                  <td className="qs-row-cell whitespace-nowrap px-3 py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(q)}>
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(q)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {preview && (
        <QuestionPreviewModal
          open
          onClose={() => setPreview(null)}
          content={preview.content}
          link={preview.link}
        />
      )}
    </>
  );
}
