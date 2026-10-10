"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Eye } from "lucide-react";
import Button from "@/components/ui/Button";
import QuestionPreviewModal from "@/components/questions/QuestionPreviewModal";
import QuestionPointsBurst from "@/components/questions/QuestionPointsBurst";
import QuestionScopeChip from "@/components/questions/QuestionScopeChip";
import QuestionStatusSelect from "@/components/questions/QuestionStatusSelect";
import type { QuestionPointBurst } from "@/lib/question-points-burst";
import {
  formatDate,
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
};

function questionDateLabel(q: QuestionListItem): string {
  const date = q.practiceDate ?? q.createdAt;
  return date ? formatDate(date) : "—";
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
    return <th className={className}>{label}</th>;
  }
  const active = sortBy === field;
  return (
    <th className={className}>
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
  showActions = false,
  sortBy,
  sortDir,
  onSort,
  loading = false,
  pointBurst = null,
}: {
  questions: QuestionListItem[];
  onStatusChange: (id: string, status: QuestionStatus) => void;
  pointBurst?: QuestionPointBurst | null;
  onEdit?: (question: QuestionListItem) => void;
  onDelete?: (id: string) => void;
  showScope?: boolean;
  showActions?: boolean;
  sortBy?: QuestionSortField;
  sortDir?: QuestionSortDir;
  onSort?: (field: QuestionSortField) => void;
  loading?: boolean;
}) {
  const questionCol = "min-w-[14rem] lg:min-w-[18rem]";
  const scopeCol = "min-w-[6.5rem]";
  const statusCol = "min-w-[10rem]";
  const dateCol = "min-w-[8.5rem]";
  const trackCol = "min-w-[7rem]";
  const viewCol = "w-12";
  const actionsCol = "min-w-[9rem]";
  const [preview, setPreview] = useState<QuestionListItem | null>(null);

  return (
    <>
      <div className={clsx("space-y-3 lg:hidden", loading && "opacity-60")}>
        {questions.map((q) => (
          <div
            key={q._id}
            style={questionRowVars(q.status)}
            className={clsx(
              "question-row-card rounded-2xl border border-[var(--border)] p-4",
              pointBurst?.id === q._id && "question-row-points-flash"
            )}
          >
            <div className="flex items-start justify-between gap-3">
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
              <span>{questionDateLabel(q)}</span>
              <span className="rounded-md bg-[var(--surface-muted)] px-1.5 py-0.5">
                {q.trackLabel || q.subjectName}
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
                  <Button variant="ghost" size="sm" onClick={() => onDelete(q._id)}>
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
          "hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] lg:block",
          loading && "opacity-60"
        )}
      >
        <div className="overflow-x-auto">
        <table className="w-full min-w-[44rem] border-separate border-spacing-y-1 text-left text-sm">
          <thead className="bg-[var(--surface-muted)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className={`${questionCol} px-4 py-3 font-semibold`}>Question</th>
              {showScope && (
                <SortableHeader
                  label="Scope"
                  field="scope"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSort={onSort}
                  className={`${scopeCol} px-4 py-3`}
                />
              )}
              <SortableHeader
                label="Status"
                field="status"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                className={`${statusCol} px-4 py-3`}
              />
              <SortableHeader
                label="Date"
                field="date"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                className={`${dateCol} px-4 py-3`}
              />
              <SortableHeader
                label="Track"
                field="track"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                className={`${trackCol} px-4 py-3`}
              />
              <th className={`${viewCol} px-2 py-3 font-semibold`} aria-label="View" />
              {showActions && <th className={`${actionsCol} px-4 py-3 font-semibold`} />}
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr
                key={q._id}
                className={clsx(
                  "question-row",
                  pointBurst?.id === q._id && "question-row-points-flash"
                )}
                style={questionRowVars(q.status)}
              >
                <td className="qs-row-cell px-4 py-3.5 text-[var(--foreground)]">
                  <p className="line-clamp-2 font-medium">
                    {splitQuestionFields(q.content).title}
                  </p>
                </td>
                {showScope && (
                  <td className="qs-row-cell px-4 py-3.5">
                    {q.scope ? <QuestionScopeChip scope={q.scope} /> : "—"}
                  </td>
                )}
                <td className={`qs-row-cell ${statusCol} px-4 py-3.5`}>
                  <div className="relative inline-block min-w-[9rem]">
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
                <td className={`qs-row-cell whitespace-nowrap px-4 py-3.5 text-[var(--muted)] ${dateCol}`}>
                  {questionDateLabel(q)}
                </td>
                <td className={`qs-row-cell whitespace-nowrap px-4 py-3.5 ${trackCol}`}>
                  <span className="rounded-md bg-[var(--surface-muted)] px-2 py-0.5 text-xs text-[var(--muted)]">
                    {q.trackLabel || q.subjectName}
                  </span>
                </td>
                <td className="qs-row-cell px-2 py-3.5 text-center">
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
                  <td className="qs-row-cell px-4 py-3.5 text-right">
                    <div className="flex justify-end gap-1">
                      {onEdit && (
                        <Button variant="ghost" size="sm" onClick={() => onEdit(q)}>
                          Edit
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="sm" onClick={() => onDelete(q._id)}>
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

      <QuestionPreviewModal
        open={preview !== null}
        onClose={() => setPreview(null)}
        content={preview?.content ?? ""}
        link={preview?.link}
      />
    </>
  );
}
