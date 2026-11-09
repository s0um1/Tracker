"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { BellRing, Flame, Medal, Timer, Trophy, Users } from "lucide-react";
import toast from "react-hot-toast";
import Card, { CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ProgressBar, { ProgressRing } from "@/components/ui/ProgressBar";
import { Heatmap, HeatLegend, WeekHeatmap } from "@/components/ui/Heatmap";
import NotesInbox from "@/components/groups/NotesInbox";
import { apiGet, apiPost, getErrorMessage } from "@/lib/api";
import { formatGroupRoleLabel } from "@/lib/group-roles";
import { CHEER_EMOJIS, NOTE_MAX_LENGTH, NUDGE_PRESETS } from "@/lib/group-notes";
import type { MomentumMember, MomentumResponse } from "@/lib/group-momentum";

const AVATAR_TONES = [
  "bg-brand/15 text-brand",
  "bg-emerald-500/15 text-emerald-600",
  "bg-sky-500/15 text-sky-600",
  "bg-violet-500/15 text-violet-600",
  "bg-pink-500/15 text-pink-600",
];

function avatarTone(name: string) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % AVATAR_TONES.length;
  return AVATAR_TONES[h];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function hours(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  return minutes % 60 ? `${h}h ${minutes % 60}m` : `${h}h`;
}

function timeAgo(iso: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

function lastOnlineLabel(m: MomentumMember) {
  return `Last online ${timeAgo(m.lastOnlineAt!)}`;
}

/** Highlight in red when nothing has been solved for a few days (or ever). */
function solvedStale(m: MomentumMember) {
  return !m.lastSolvedAt || Date.now() - new Date(m.lastSolvedAt).getTime() >= 3 * 86_400_000;
}

function lastSolvedLabel(m: MomentumMember) {
  return m.lastSolvedAt ? `Last solved ${timeAgo(m.lastSolvedAt)}` : "No questions solved yet";
}

/** Weekday letter for a "YYYY-MM-DD" key, in the app's timezone. */
function weekday(key: string) {
  return new Date(`${key}T12:00:00+05:30`).toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" });
}

function MemberCard({
  member,
  totalQuestions,
  todayKey,
  isAdmin,
  onCheer,
  onNudge,
}: {
  member: MomentumMember;
  totalQuestions: number;
  todayKey: string;
  isAdmin: boolean;
  onCheer: (m: MomentumMember, emoji: string) => void;
  onNudge: (m: MomentumMember) => void;
}) {
  const style = member.online
    ? { dot: "bg-emerald-500", text: "text-emerald-600" }
    : { dot: "bg-stone-400", text: "text-[var(--muted)]" };
  const cheered = member.sentToday.includes("cheer");
  const nudged = member.sentToday.includes("nudge");

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <div className={clsx("flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold", avatarTone(member.name))}>
            {initials(member.name)}
          </div>
          <span
            className={clsx("absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-[var(--card)]", style.dot)}
            aria-hidden
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{member.name}</p>
            {member.isSelf && <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-semibold text-brand">You</span>}
          </div>
          <p className="text-[11px] text-[var(--muted)]">{formatGroupRoleLabel(member.role)}</p>
          {member.online ? (
            <p className={clsx("mt-0.5 text-xs font-medium", style.text)}>Online now</p>
          ) : (
            <>
              {member.lastOnlineAt && <p className="mt-0.5 text-xs text-[var(--muted)]">{lastOnlineLabel(member)}</p>}
              <p className={clsx("text-xs font-medium", solvedStale(member) ? "text-red-500" : "text-[var(--muted)]")}>
                {lastSolvedLabel(member)}
              </p>
            </>
          )}
        </div>
        {member.studyStreak > 0 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-[11px] font-semibold text-orange-600">
            <Flame className="h-3 w-3" aria-hidden /> {member.studyStreak}
          </span>
        )}
      </div>

      <div>
        <p className="mb-2 text-xs text-[var(--muted)]">
          <span className="font-semibold text-[var(--foreground)]">{member.doneWeek}</span> this week
          {member.minutesWeek > 0 && <> · {hours(member.minutesWeek)}</>}
        </p>
        <WeekHeatmap heat={member.heat} todayKey={todayKey} label={`${member.name}'s questions completed this week`} />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between gap-2 text-[11px] text-[var(--muted)]">
          <span>
            Questions done{" "}
            <span className="font-semibold text-[var(--foreground)]">
              {member.questionsDone}/{totalQuestions}
            </span>
          </span>
          <span className="font-semibold">{member.donePercent}%</span>
        </div>
        <ProgressBar value={member.donePercent} size="sm" />
      </div>

      {member.behindReasons.length > 0 && (
        <p className="rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          {member.behindReasons.join(" · ")}
        </p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
        {member.isSelf ? (
          <p className="text-xs text-[var(--muted)]">
            {member.cheersWeek > 0 ? `${member.cheersWeek} cheer${member.cheersWeek === 1 ? "" : "s"} this week` : "No cheers yet this week"}
          </p>
        ) : (
          <>
            {cheered ? (
              <span className="text-xs font-medium text-emerald-600">Cheered today ✓</span>
            ) : (
              <div className="flex items-center gap-1" role="group" aria-label={`Cheer ${member.name}`}>
                {CHEER_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onCheer(member, emoji)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-base transition-transform hover:scale-110 hover:bg-brand/15 focus-visible:shadow-focus"
                    aria-label={`Send ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
            {isAdmin && member.behindReasons.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="ml-auto"
                disabled={nudged}
                onClick={() => onNudge(member)}
              >
                <BellRing className="mr-1 h-3.5 w-3.5" aria-hidden /> {nudged ? "Nudged today" : "Nudge"}
              </Button>
            )}
            {member.cheersWeek > 0 && !isAdmin && (
              <span className="ml-auto text-[11px] text-[var(--muted)]">{member.cheersWeek} 👏 this week</span>
            )}
          </>
        )}
      </div>
    </li>
  );
}

export default function GroupMomentumPanel({ groupId }: { groupId: string }) {
  const [data, setData] = useState<MomentumResponse | null>(null);
  const [error, setError] = useState(false);
  const [nudgeTarget, setNudgeTarget] = useState<MomentumMember | null>(null);
  const [nudgeText, setNudgeText] = useState<string>(NUDGE_PRESETS[0]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await apiGet<MomentumResponse>(`/api/group-dynamics?groupId=${groupId}`));
      setError(false);
    } catch {
      setError(true);
    }
  }, [groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Record what was sent so the buttons update immediately, without waiting for a reload.
  const markSent = (userId: string, kind: string) =>
    setData((d) =>
      d
        ? {
            ...d,
            members: d.members.map((m) =>
              m.userId === userId
                ? { ...m, sentToday: [...m.sentToday, kind], cheersWeek: kind === "cheer" ? m.cheersWeek + 1 : m.cheersWeek }
                : m
            ),
          }
        : d
    );

  const send = async (toUserId: string, kind: "cheer" | "nudge", extra: { emoji?: string; message?: string }) => {
    await apiPost("/api/group-notes", { groupId, toUserId, kind, ...extra });
    markSent(toUserId, kind);
  };

  const cheer = async (m: MomentumMember, emoji: string) => {
    try {
      await send(m.userId, "cheer", { emoji });
      toast.success(`${emoji} sent to ${m.name.split(" ")[0]}`);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't send the cheer"));
    }
  };

  const sendNudge = async () => {
    if (!nudgeTarget || !nudgeText.trim()) return;
    setSending(true);
    try {
      await send(nudgeTarget.userId, "nudge", { message: nudgeText.trim() });
      toast.success(`Nudge sent to ${nudgeTarget.name.split(" ")[0]}`);
      setNudgeTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't send the nudge"));
    } finally {
      setSending(false);
    }
  };

  if (error) return null;
  if (!data) {
    return (
      <Card aria-busy="true" aria-label="Loading group momentum">
        <div className="h-40 animate-pulse rounded-xl bg-[var(--surface-muted)]" />
      </Card>
    );
  }

  const { team, highlights, members } = data;
  const goalPct = team.goal ? Math.round((team.doneWeek / team.goal) * 100) : 0;
  const maxQuestions = Math.max(1, ...team.days.map((d) => d.questions));
  const milestoneSpan = team.milestone.next - team.milestone.prev;
  const milestonePct = milestoneSpan ? Math.round(((team.totalDone - team.milestone.prev) / milestoneSpan) * 100) : 0;
  const todayKey = team.days.find((d) => d.isToday)?.key ?? team.days[team.days.length - 1].key;
  const highlightRows = [
    { key: "topSolver", icon: Trophy, label: "Top solver", h: highlights.topSolver, unit: (v: number) => `${v} solved` },
    { key: "mostConsistent", icon: Medal, label: "Most consistent", h: highlights.mostConsistent, unit: (v: number) => `${v}/7 days` },
    { key: "mostFocused", icon: Timer, label: "Most focused", h: highlights.mostFocused, unit: (v: number) => hours(v) },
  ].filter((r) => r.h);

  return (
    <section className="space-y-6" aria-label="Group momentum">
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/15 via-transparent to-transparent" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">Group momentum</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight">{data.headline.title}</h2>
            <p className="mt-1 max-w-md text-sm text-[var(--muted)]">{data.headline.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-orange-600">
                <Flame className="h-3.5 w-3.5" aria-hidden /> {team.streak}-day team streak
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-muted)] px-2.5 py-1">
                <Users className="h-3.5 w-3.5" aria-hidden /> {team.activeMembers} of {team.memberCount} active this week
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="text-center">
              <ProgressRing value={goalPct} size={92} />
              <p className="mt-1 text-[11px] text-[var(--muted)]">
                Weekly goal · {team.doneWeek}/{team.goal}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <NotesInbox groupId={groupId} compact />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="This week" subtitle="Questions completed each day, plus how many teammates showed up" />
          <div className="mt-6 flex items-end gap-2 sm:gap-3" role="img" aria-label="Questions completed per day this week">
            {team.days.map((d) => (
              <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
                <span className="text-[11px] font-semibold">{d.questions || ""}</span>
                <div className="flex h-44 w-full items-end">
                  <div
                    className={clsx(
                      "w-full rounded-t-md transition-all",
                      d.questions === 0 ? "bg-[var(--surface-muted)]" : d.isToday ? "bg-brand" : "bg-brand/50"
                    )}
                    style={{ height: `${Math.max(6, (d.questions / maxQuestions) * 100)}%` }}
                    title={`${d.questions} question${d.questions === 1 ? "" : "s"}, ${d.activeMembers} teammate${d.activeMembers === 1 ? "" : "s"}`}
                  />
                </div>
                <span className={clsx("text-[11px]", d.isToday ? "font-semibold text-brand" : "text-[var(--muted)]")}>
                  {weekday(d.key)}
                </span>
                <span className="text-[10px] text-[var(--muted)]">{d.activeMembers > 0 ? `${d.activeMembers} 👤` : "–"}</span>
              </div>
            ))}
          </div>
          {highlightRows.length > 0 && (
            <ul className="mt-5 grid gap-2 sm:grid-cols-3">
              {highlightRows.map(({ key, icon: Icon, label, h, unit }) => (
                <li key={key} className="flex items-center gap-2.5 rounded-xl bg-[var(--surface-muted)] p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600">
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] text-[var(--muted)]">{label}</p>
                    <p className="truncate text-sm font-semibold">{h!.name}</p>
                    <p className="text-[11px] text-[var(--muted)]">{unit(h!.value)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Next milestone" subtitle={`Team total: ${team.totalDone} questions done`} />
            <div className="mb-1.5 flex justify-between text-xs">
              <span className="text-[var(--muted)]">{team.milestone.prev}</span>
              <span className="font-semibold">{team.milestone.next} questions</span>
            </div>
            <ProgressBar value={milestonePct} size="lg" tone="brand" />
            <p className="mt-2 text-xs text-[var(--muted)]">
              {Math.max(0, team.milestone.next - team.totalDone)} more to go as a team.
            </p>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Group activity" subtitle="Questions the team completed each day" action={<HeatLegend />} />
        <Heatmap heat={team.heat} todayKey={todayKey} label="Group questions completed over time" />
      </Card>

      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-base font-semibold">Teammates</h3>
          <p className="text-xs text-[var(--muted)]">
            Send a cheer to brighten someone&apos;s day{data.isAdmin ? ". Admins can also nudge anyone who's quiet." : "."}
          </p>
        </div>
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {members.map((m) => (
            <MemberCard key={m.userId} member={m} totalQuestions={team.totalQuestions} todayKey={todayKey} isAdmin={data.isAdmin} onCheer={cheer} onNudge={(t) => { setNudgeText(NUDGE_PRESETS[0]); setNudgeTarget(t); }} />
          ))}
        </ul>
      </div>

      <Modal open={nudgeTarget !== null} onClose={() => setNudgeTarget(null)} title={`Nudge ${nudgeTarget?.name.split(" ")[0] ?? ""}`} size="sm">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendNudge();
          }}
        >
          <p className="text-sm text-[var(--muted)]">Pick a friendly message or write your own. They&apos;ll see it on their dashboard.</p>
          <div className="space-y-2">
            {NUDGE_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setNudgeText(p)}
                className={clsx(
                  "w-full rounded-xl border p-3 text-left text-sm transition-colors",
                  nudgeText === p ? "border-brand bg-brand/10" : "border-[var(--border)] hover:bg-[var(--surface-muted)]"
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="block text-xs font-medium text-[var(--muted)]">
            Or write your own
            <textarea
              value={nudgeText}
              onChange={(e) => setNudgeText(e.target.value.slice(0, NOTE_MAX_LENGTH))}
              rows={3}
              className="input mt-1 !text-sm"
            />
            <span className="mt-0.5 block text-right text-[10px]">
              {nudgeText.length}/{NOTE_MAX_LENGTH}
            </span>
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="ghost" size="sm" onClick={() => setNudgeTarget(null)} disabled={sending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={sending} disabled={!nudgeText.trim()}>
              {sending ? "Sending…" : "Send nudge"}
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
