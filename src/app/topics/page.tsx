"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet, apiPatch, apiPost, getErrorMessage } from "@/lib/api";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Chip from "@/components/ui/Chip";
import Modal from "@/components/ui/Modal";
import { ConfidenceBadge, PriorityBadge } from "@/components/ui/Badge";
import { TopicsPageSkeleton, ErrorState, EmptyState } from "@/components/ui/StateViews";
import { TOPIC_STATUS_META } from "@/lib/utils";
import toast from "react-hot-toast";
import type { ContentScope, Subject, TopicWithProgress } from "@/types";

function TopicsContent() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const subjectFilter = searchParams.get("subjectId");
  const [tab, setTab] = useState<ContentScope>("group");
  const [topics, setTopics] = useState<TopicWithProgress[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");

  const load = useCallback(async () => {
    if (!user?.activeGroupId && tab === "group") {
      setLoading(false);
      setTopics([]);
      setSubjects([]);
      return;
    }
    setLoading(true);
    try {
      const subjectUrl =
        tab === "group"
          ? `/api/subjects?groupId=${user!.activeGroupId}&scope=group`
          : `/api/subjects?scope=personal`;
      let topicUrl = `/api/topics?groupId=${user!.activeGroupId}&scope=${tab}`;
      if (subjectFilter) topicUrl += `&subjectId=${subjectFilter}`;

      const [topicData, subjectData] = await Promise.all([
        apiGet<TopicWithProgress[]>(topicUrl),
        apiGet<Subject[]>(subjectUrl),
      ]);
      setTopics(topicData);
      setSubjects(subjectData);
      const defaultSubject = subjectFilter || subjectData[0]?._id || "";
      setNewSubjectId((prev) => {
        if (prev && subjectData.some((s) => s._id === prev)) return prev;
        return defaultSubject;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load topics");
    } finally {
      setLoading(false);
    }
  }, [user, subjectFilter, tab]);

  useEffect(() => { load(); }, [load]);

  const createTopic = async () => {
    if (!newName.trim() || !newSubjectId || !user?.activeGroupId) return;
    try {
      await apiPost("/api/topics", {
        groupId: user.activeGroupId,
        subjectId: newSubjectId,
        name: newName,
      });
      toast.success("Topic created");
      setShowModal(false);
      setNewName("");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to create topic"));
    }
  };

  const updateTopic = async (topicId: string, updates: Record<string, string>) => {
    try {
      await apiPatch(`/api/topics/${topicId}`, updates);
      toast.success("Topic updated");
      load();
    } catch (err) {
      toast.error(getErrorMessage(err, "Failed to update topic"));
    }
  };

  if (loading) return <TopicsPageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const grouped = topics.reduce<Record<string, TopicWithProgress[]>>((acc, t) => {
    const key = t.subjectName ?? "Other";
    (acc[key] ??= []).push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Topics</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {tab === "group"
              ? "Shared topics under group subjects — used when adding group questions."
              : "Your private topics under personal subjects."}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} disabled={subjects.length === 0}>
          Add Topic
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["group", "personal"] as ContentScope[]).map((scope) => (
          <Chip
            key={scope}
            variant="brand"
            active={tab === scope}
            onClick={() => setTab(scope)}
            className="!px-4 !py-1.5 !text-sm"
          >
            {scope === "group" ? "Group Topics" : "My Topics"}
          </Chip>
        ))}
      </div>

      {subjects.length === 0 ? (
        <EmptyState
          title={tab === "group" ? "Add a group subject first" : "Add a personal subject first"}
          description="Create subjects before adding topics."
        />
      ) : topics.length === 0 ? (
        <EmptyState
          title="No topics yet"
          description="Add topics under each subject, then pick them when logging questions."
          action={<Button onClick={() => setShowModal(true)}>Add Topic</Button>}
        />
      ) : (
        Object.entries(grouped).map(([subject, subjectTopics]) => (
          <div key={subject}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">{subject}</h2>
            <div className="space-y-2">
              {subjectTopics.map((t) => {
                const status = t.userStatus ?? t.status;
                const confidence = t.userConfidence ?? t.confidence;
                const meta = TOPIC_STATUS_META[status] ?? TOPIC_STATUS_META.not_started;
                return (
                  <Card key={t._id} padded className="!p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-[var(--foreground)]">{t.name}</span>
                          <PriorityBadge priority={t.priority} />
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                          <ConfidenceBadge confidence={confidence} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <select
                          value={status}
                          onChange={(e) => updateTopic(t._id, { status: e.target.value })}
                          className="rounded-lg border border-[var(--input-border)] px-2 py-1 text-xs dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
                        >
                          {Object.entries(TOPIC_STATUS_META).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                        <select
                          value={confidence}
                          onChange={(e) => updateTopic(t._id, { confidence: e.target.value })}
                          className="rounded-lg border border-[var(--input-border)] px-2 py-1 text-xs dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
                        >
                          <option value="weak">Weak</option>
                          <option value="okay">Okay</option>
                          <option value="strong">Strong</option>
                        </select>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Add Topic">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Subject</label>
            <select
              value={newSubjectId}
              onChange={(e) => setNewSubjectId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
            >
              {subjects.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Topic name"
            className="w-full rounded-lg border border-[var(--input-border)] px-4 py-2.5 text-sm dark:border-[var(--input-border)] dark:bg-[var(--input-bg)]"
          />
          <Button onClick={createTopic} className="w-full" disabled={!newName.trim() || !newSubjectId}>
            Save Topic
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export default function TopicsPage() {
  return (
    <Suspense fallback={<TopicsPageSkeleton />}>
      <TopicsContent />
    </Suspense>
  );
}
