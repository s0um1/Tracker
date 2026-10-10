"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import AppLogo from "@/components/ui/AppLogo";
import { apiPost, getErrorMessage } from "@/lib/api";
import { useUser } from "@/components/providers/UserProvider";
import toast from "react-hot-toast";
import type { User, Group } from "@/types";

const STEPS = ["Welcome", "Subjects", "Study Time", "Group"];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setUser } = useUser();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(user?.name ?? "");
  const [subjects, setSubjects] = useState<string[]>([]);
  const [newSubject, setNewSubject] = useState("");
  const [preparationLevel, setPreparationLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [dailyStudyMinutes, setDailyStudyMinutes] = useState(120);
  const [groupAction, setGroupAction] = useState<"create" | "join">("create");
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const addSubject = () => {
    const trimmed = newSubject.trim();
    if (!trimmed) return;
    if (subjects.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Subject already added");
      return;
    }
    setSubjects((prev) => [...prev, trimmed]);
    setNewSubject("");
  };

  const removeSubject = (subject: string) => {
    setSubjects((prev) => prev.filter((s) => s !== subject));
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const result = await apiPost<{ user: User; group: Group }>("/api/onboarding", {
        name: name || user?.name,
        subjects,
        preparationLevel,
        dailyStudyMinutes,
        groupAction,
        groupName: groupAction === "create" ? groupName || `${name || user?.name}'s Prep Group` : undefined,
        joinCode: groupAction === "join" ? joinCode : undefined,
      });
      setUser(result.user);
      toast.success("Welcome to GrowthHub!");
      router.push("/dashboard");
    } catch (err) {
      toast.error(getErrorMessage(err, "Setup failed"));
    } finally {
      setLoading(false);
    }
  };

  const canNext = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return true;
    if (step === 2) return dailyStudyMinutes > 0;
    if (step === 3) return groupAction === "create" || joinCode.length === 6;
    return false;
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 w-fit">
            <AppLogo />
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">GrowthHub</h1>
        </div>

        <div className="mb-6 flex justify-center gap-1">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1.5 w-10 rounded-full transition-colors ${
                i <= step ? "bg-brand" : "bg-stone-200 bg-stone-700"
              }`}
            />
          ))}
        </div>

        <Card>
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">What&apos;s your name?</h2>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="w-full rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
                autoFocus
              />
              <div>
                <label className="text-sm font-medium text-[var(--foreground)]">Preparation level</label>
                <div className="mt-2 flex gap-2">
                  {(["beginner", "intermediate", "advanced"] as const).map((level) => (
                    <button
                      key={level}
                      onClick={() => setPreparationLevel(level)}
                      className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium capitalize ${
                        preparationLevel === level
                          ? "border-brand bg-brand/10 text-brand"
                          : "border-[var(--border)] text-[var(--muted)] "
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Which subjects are you preparing?</h2>
              <p className="text-sm text-[var(--muted)]">Add your own subjects. You can add more later from the Subjects page.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSubject())}
                  placeholder="e.g. System Design"
                  className="flex-1 rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
                />
                <Button type="button" variant="outline" onClick={addSubject} disabled={!newSubject.trim()}>
                  Add
                </Button>
              </div>
              {subjects.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {subjects.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 rounded-lg border border-brand/30 bg-brand/10 px-3 py-1.5 text-sm font-medium text-brand"
                    >
                      {s}
                      <button
                        type="button"
                        onClick={() => removeSubject(s)}
                        className="text-brand/70 hover:text-brand"
                        aria-label={`Remove ${s}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--muted)]">No subjects yet — skip for now or add at least one.</p>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Daily study time available?</h2>
              <input
                type="range"
                min={30}
                max={480}
                step={15}
                value={dailyStudyMinutes}
                onChange={(e) => setDailyStudyMinutes(Number(e.target.value))}
                className="w-full"
              />
              <p className="text-center text-2xl font-bold text-brand">
                {Math.floor(dailyStudyMinutes / 60)}h {dailyStudyMinutes % 60}m
              </p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Create or join a group</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setGroupAction("create")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    groupAction === "create" ? "border-brand bg-brand/10 text-brand" : "border-[var(--border)]"
                  }`}
                >
                  Create Group
                </button>
                <button
                  onClick={() => setGroupAction("join")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                    groupAction === "join" ? "border-brand bg-brand/10 text-brand" : "border-[var(--border)]"
                  }`}
                >
                  Join Group
                </button>
              </div>
              {groupAction === "create" ? (
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={`${name}'s Prep Group (optional)`}
                  className="w-full rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
                />
              ) : (
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  className="w-full rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm font-mono tracking-widest dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
                />
              )}
            </div>
          )}

          <div className="mt-6 flex justify-between">
            <Button
              variant="ghost"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}>
                Continue
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={!canNext() || loading}>
                {loading ? "Setting up..." : "Launch Dashboard"}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
