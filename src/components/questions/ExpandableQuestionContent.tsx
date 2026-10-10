"use client";

import { useState } from "react";
import clsx from "clsx";
import { isExpandableQuestion, splitQuestionFields } from "@/lib/utils";

export default function ExpandableQuestionContent({
  content,
  className,
  collapsedClassName = "line-clamp-3",
}: {
  content: string;
  className?: string;
  collapsedClassName?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const { title, description } = splitQuestionFields(content);
  const expandable = isExpandableQuestion(content);

  return (
    <div className={className}>
      <p className="text-sm font-medium text-[var(--foreground)]">{title}</p>
      {description ? (
        <p
          className={clsx(
            "mt-1 text-sm whitespace-pre-wrap text-[var(--muted)]",
            !expanded && expandable && collapsedClassName
          )}
        >
          {description}
        </p>
      ) : null}
      {expandable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 text-xs font-medium text-brand hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
