"use client";

import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { splitQuestionFields } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export default function QuestionPreviewModal({
  open,
  onClose,
  content,
  link,
}: {
  open: boolean;
  onClose: () => void;
  content: string;
  link?: string;
}) {
  const { title, description } = splitQuestionFields(content);

  return (
    <Modal open={open} onClose={onClose} title="Question">
      <div className="space-y-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Title
          </p>
          <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{title || "—"}</p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            Description
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--foreground)]">
            {description || "—"}
          </p>
        </div>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            Open link
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        ) : (
          <p className="text-sm text-[var(--muted)]">No link attached.</p>
        )}
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
