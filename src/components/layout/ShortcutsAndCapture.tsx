"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useUser } from "@/components/providers/UserProvider";
import { apiPost, getErrorMessage } from "@/lib/api";

type Priority = "critical" | "high" | "medium" | "low";

const GO_KEYS: { key: string; label: string; href: (groupId?: string) => string | null }[] = [
  { key: "d", label: "Dashboard", href: () => "/dashboard" },
  { key: "q", label: "Questions", href: () => "/questions" },
  { key: "t", label: "Tasks", href: () => "/tasks" },
  { key: "a", label: "Analytics", href: () => "/analytics" },
  { key: "m", label: "Mock interviews", href: (g) => (g ? `/groups/${g}/mock-interviews` : null) },
];

function isTyping(el: EventTarget | null) {
  const node = el as HTMLElement | null;
  if (!node) return false;
  return node.tagName === "INPUT" || node.tagName === "TEXTAREA" || node.tagName === "SELECT" || node.isContentEditable;
}

/** Global shortcuts (g then a letter to navigate, c to capture, ? for help) and the quick-capture dialog. */
export const OPEN_QUICK_CAPTURE_EVENT = "growthhub:quick-capture";

export default function ShortcutsAndCapture() {
  const { user } = useUser();
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [saving, setSaving] = useState(false);
  const awaitingGo = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupId = user?.activeGroupId;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      if (document.body.classList.contains("growthhub-modal-open")) return;

      if (awaitingGo.current) {
        clearTimeout(awaitingGo.current);
        awaitingGo.current = null;
        const target = GO_KEYS.find((g) => g.key === e.key.toLowerCase());
        const href = target?.href(groupId);
        if (href) {
          e.preventDefault();
          router.push(href);
        }
        return;
      }
      if (e.key === "g") {
        awaitingGo.current = setTimeout(() => {
          awaitingGo.current = null;
        }, 1200);
      } else if (e.key === "c") {
        e.preventDefault();
        setCaptureOpen(true);
      } else if (e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [groupId, router]);

  // Lets the mobile top bar open the dialog without owning its state.
  useEffect(() => {
    const open = () => setCaptureOpen(true);
    window.addEventListener(OPEN_QUICK_CAPTURE_EVENT, open);
    return () => window.removeEventListener(OPEN_QUICK_CAPTURE_EVENT, open);
  }, []);

  const save = useCallback(async () => {
    if (!groupId || !title.trim()) return;
    setSaving(true);
    try {
      await apiPost("/api/tasks", { groupId, title: title.trim(), priority });
      toast.success("Captured as a task");
      setTitle("");
      setPriority("medium");
      setCaptureOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }, [groupId, title, priority]);

  if (!groupId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setCaptureOpen(true)}
        aria-label="Quick capture (c)"
        title="Quick capture (c)"
        className="fixed bottom-6 right-6 z-30 hidden h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-lg transition-transform hover:scale-105 focus-visible:shadow-focus lg:flex"
      >
        <Plus className="h-6 w-6" aria-hidden />
      </button>

      <Modal open={captureOpen} onClose={() => setCaptureOpen(false)} title="Quick capture" size="sm">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Revise OS scheduling, ask about CAP theorem…"
            className="input !text-sm"
            maxLength={200}
          />
          <div className="flex gap-1.5">
            {(["low", "medium", "high", "critical"] as Priority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`flex-1 rounded-md border px-2 py-1 text-xs font-medium capitalize ${
                  priority === p ? "border-brand bg-brand/10 text-brand" : "border-[var(--border)] text-[var(--muted)]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button size="sm" type="submit" disabled={saving || !title.trim()}>
              {saving ? "Saving…" : "Add task"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={helpOpen} onClose={() => setHelpOpen(false)} title="Keyboard shortcuts" size="sm">
        <ul className="space-y-1.5 text-sm">
          <li className="flex justify-between">
            <span>Quick capture</span>
            <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">c</kbd>
          </li>
          {GO_KEYS.map((g) => (
            <li key={g.key} className="flex justify-between">
              <span>Go to {g.label}</span>
              <span>
                <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">g</kbd>{" "}
                <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">{g.key}</kbd>
              </span>
            </li>
          ))}
          <li className="flex justify-between">
            <span>This help</span>
            <kbd className="rounded bg-[var(--surface-muted)] px-1.5 text-xs">?</kbd>
          </li>
        </ul>
      </Modal>
    </>
  );
}
