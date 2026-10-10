"use client";

import { useState, useEffect, useCallback } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import { apiPost, getErrorMessage } from "@/lib/api";
import toast from "react-hot-toast";

const DEFAULT_FOCUS_MINUTES = 25;
const FOCUS_PRESETS = [15, 25, 45, 60];

function clampMinutes(value: number) {
  return Math.min(180, Math.max(1, Math.round(value)));
}

export default function FocusTimer({
  subjectId,
  topicId,
  taskId,
  groupId,
  label,
  onComplete,
}: {
  subjectId?: string;
  topicId?: string;
  taskId?: string;
  groupId?: string;
  label?: string;
  onComplete?: () => void;
}) {
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_FOCUS_MINUTES);
  const [seconds, setSeconds] = useState(DEFAULT_FOCUS_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<Date | null>(null);

  const totalSeconds = durationMinutes * 60;
  const isPaused = !running && seconds > 0 && seconds < totalSeconds;

  const applyDuration = (mins: number, resetTimer = true) => {
    const next = clampMinutes(mins);
    setDurationMinutes(next);
    if (resetTimer && !running) setSeconds(next * 60);
  };

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          setRunning(false);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [running]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleComplete = useCallback(async () => {
    const duration = startedAt
      ? Math.min(
          durationMinutes,
          Math.max(1, Math.round((Date.now() - startedAt.getTime()) / 60000))
        )
      : durationMinutes;
    try {
      await apiPost("/api/study-sessions", {
        groupId,
        subjectId,
        topicId,
        taskId,
        durationMinutes: duration,
        startedAt: startedAt?.toISOString(),
      });
      toast.success(`Focus session logged (${duration} min)`);
      onComplete?.();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to save session"));
    }
    setSeconds(durationMinutes * 60);
    setStartedAt(null);
  }, [groupId, subjectId, topicId, taskId, startedAt, durationMinutes, onComplete]);

  useEffect(() => {
    if (seconds === 0 && !running && startedAt) {
      handleComplete();
    }
  }, [seconds, running, startedAt, handleComplete]);

  return (
    <Card>
      <CardHeader title="Focus Session" subtitle={label} />
      <div className="flex flex-col items-center py-4">
        <div className="text-5xl font-mono font-bold tabular-nums text-[var(--foreground)]">
          {formatTime(seconds)}
        </div>
        {!running && (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {FOCUS_PRESETS.map((mins) => (
              <Chip
                key={mins}
                variant="brand"
                active={durationMinutes === mins}
                onClick={() => applyDuration(mins)}
                className="!px-2.5 !py-1 !text-xs"
              >
                {mins}m
              </Chip>
            ))}
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              Custom
              <input
                type="number"
                min={1}
                max={180}
                value={durationMinutes}
                onChange={(e) => applyDuration(Number(e.target.value) || DEFAULT_FOCUS_MINUTES)}
                onWheel={(e) => e.currentTarget.blur()}
                className="w-14 rounded-md border border-[var(--input-border)] bg-[var(--input-bg)] px-2 py-1 text-center text-xs text-[var(--foreground)]"
              />
              min
            </label>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          {!running ? (
            <Button
              onClick={() => {
                setRunning(true);
                if (!startedAt) setStartedAt(new Date());
              }}
            >
              <Play className="h-4 w-4" strokeWidth={2.25} fill="currentColor" />
              {isPaused ? "Resume" : "Start Focus"}
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setRunning(false)}>
              <Pause className="h-4 w-4" strokeWidth={2.25} />
              Pause
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              setSeconds(durationMinutes * 60);
              setRunning(false);
              setStartedAt(null);
            }}
          >
            <RotateCcw className="h-4 w-4" strokeWidth={2} />
            Reset
          </Button>
        </div>
      </div>
    </Card>
  );
}
