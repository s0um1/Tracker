"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import {
  formatJoinCodeCountdown,
  isJoinCodeActive,
  joinCodeSecondsRemaining,
} from "@/lib/utils";
import toast from "react-hot-toast";

type InviteCodeBlockProps = {
  joinCode?: string;
  joinCodeExpiresAt?: string;
  onGenerate?: (opts?: { force?: boolean }) => void | Promise<void>;
  generating?: boolean;
  compact?: boolean;
  inline?: boolean;
};

export default function InviteCodeBlock({
  joinCode,
  joinCodeExpiresAt,
  onGenerate,
  generating,
  compact,
  inline,
}: InviteCodeBlockProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const valid =
    Boolean(joinCode) && Boolean(joinCodeExpiresAt) && isJoinCodeActive(joinCode!, joinCodeExpiresAt);

  useEffect(() => {
    if (!joinCode || !joinCodeExpiresAt || !isJoinCodeActive(joinCode, joinCodeExpiresAt)) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => setSecondsLeft(joinCodeSecondsRemaining(joinCodeExpiresAt));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [joinCode, joinCodeExpiresAt]);

  const copy = () => {
    if (!joinCode) return;
    navigator.clipboard.writeText(joinCode);
    toast.success("Invite code copied!");
  };

  const requestNewCode = async () => {
    if (!onGenerate) return;
    if (valid && secondsLeft > 0) {
      const ok = window.confirm(
        "Replace the current invite code? Anyone with the old code won't be able to join."
      );
      if (!ok) return;
      await onGenerate({ force: true });
      return;
    }
    await onGenerate();
  };

  if (!valid) {
    if (!onGenerate) return null;
    return (
      <Button
        variant={inline ? "ghost" : "outline"}
        size="sm"
        onClick={() => onGenerate()}
        disabled={generating}
        className={compact && !inline ? "w-full" : undefined}
      >
        {generating ? "Generating…" : joinCode ? "Generate code" : "Generate code"}
      </Button>
    );
  }

  if (inline) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-sm font-bold tracking-[0.2em] text-[var(--foreground)]">
          {joinCode}
        </code>
        <Button variant="ghost" size="sm" onClick={copy}>
          Copy
        </Button>
        {onGenerate ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={requestNewCode}
            disabled={generating}
          >
            {generating ? "…" : "New"}
          </Button>
        ) : null}
        <span className="text-xs text-[var(--muted)]">
          · {formatJoinCodeCountdown(secondsLeft)}
        </span>
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <code
          className={
            compact
              ? "rounded-lg bg-[var(--surface-muted)] px-3 py-1.5 text-base font-mono font-bold tracking-[0.2em]"
              : "rounded-lg bg-[var(--surface-muted)] px-4 py-2 text-lg font-mono font-bold tracking-[0.2em]"
          }
        >
          {joinCode}
        </code>
        <Button variant="outline" size="sm" onClick={copy}>
          Copy
        </Button>
        {onGenerate ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={requestNewCode}
            disabled={generating}
          >
            {generating ? "…" : "New code"}
          </Button>
        ) : null}
      </div>
      <p className="text-xs text-[var(--muted)]">
        Expires in {formatJoinCodeCountdown(secondsLeft)}
        {secondsLeft > 0 ? " — or use New to replace early" : ""}
      </p>
    </div>
  );
}
