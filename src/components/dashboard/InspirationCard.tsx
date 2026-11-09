"use client";

import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import Card from "@/components/ui/Card";
import Chip from "@/components/ui/Chip";
import Button from "@/components/ui/Button";
import { pickInspiration, formatCtcTarget, type InspirationTone } from "@/lib/inspiration";

const TONE_STYLES: Record<InspirationTone, { label: string; border: string; variant: "success" | "warning" | "brand" }> = {
  motivational: {
    label: "Fuel",
    border: "border-[color-mix(in_srgb,var(--chip-success-text)_30%,transparent)]",
    variant: "success",
  },
  demotivational: {
    label: "Reality check",
    border: "border-[color-mix(in_srgb,var(--chip-warning-text)_30%,transparent)]",
    variant: "warning",
  },
  ctc: {
    label: "CTC target",
    border: "border-[color-mix(in_srgb,var(--accent)_30%,transparent)]",
    variant: "brand",
  },
};

export default function InspirationCard({
  studyStreak,
  daysToInterview,
  targetCtcLpa,
}: {
  studyStreak: number;
  daysToInterview: number;
  targetCtcLpa?: number;
}) {
  const [seed, setSeed] = useState(0);

  const message = useMemo(
    () =>
      pickInspiration({
        studyStreak,
        daysToInterview,
        targetCtcLpa,
        seed,
      }),
    [studyStreak, daysToInterview, targetCtcLpa, seed]
  );

  const style = TONE_STYLES[message.tone];

  return (
    <Card className={`border ${style.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Chip variant={style.variant}>{style.label}</Chip>
            {targetCtcLpa && targetCtcLpa > 0 && (
              <Chip variant="brand">Goal: {formatCtcTarget(targetCtcLpa)}</Chip>
            )}
          </div>
          <p className="mt-3 text-base font-medium leading-relaxed text-[var(--foreground)]">
            &ldquo;{message.text}&rdquo;
          </p>
          {message.author && (
            <p className="mt-2 text-xs text-[var(--muted)]">— {message.author}</p>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setSeed((s) => s + 1)} aria-label="New quote">
          <RefreshCw className="h-4 w-4" strokeWidth={2} />
        </Button>
      </div>
    </Card>
  );
}
