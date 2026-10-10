"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import Card, { CardHeader } from "@/components/ui/Card";
import { ReadinessRing } from "@/components/ui/ProgressBar";
import { ProfilePageSkeleton, ErrorState } from "@/components/ui/StateViews";
import { formatDate } from "@/lib/utils";
import type { UserProfile } from "@/types";

export default function UserProfilePage() {
  const params = useParams();
  const userId = params.id as string;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiGet<UserProfile & { isSelf?: boolean }>(
        `/api/users/${userId}/profile`
      );
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <ProfilePageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">{profile.name}</h1>
          <p className="text-sm text-[var(--muted)]">@{profile.username}</p>
          {profile.joinedAt && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              Group member since {formatDate(profile.joinedAt)}
            </p>
          )}
        </div>
        <ReadinessRing value={profile.readiness} size={72} />
      </div>

      <Card>
        <p className="text-xs text-[var(--muted)]">Tasks done</p>
        <p className="text-2xl font-bold">
          {profile.tasksCompleted}/{profile.tasksTotal}
        </p>
      </Card>

      {profile.sharedGroups.length > 0 && (
        <Card>
          <CardHeader title="Shared groups" />
          <div className="space-y-2">
            {profile.sharedGroups.map((g) => (
              <Link
                key={g._id}
                href={`/groups/${g._id}`}
                className="block rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-muted)]  dark:hover:bg-[var(--surface-muted)]"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
