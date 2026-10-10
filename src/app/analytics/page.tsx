"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@/components/providers/UserProvider";
import { apiGet } from "@/lib/api";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { AnalyticsPageSkeleton, ErrorState, EmptyState } from "@/components/ui/StateViews";
import type { AnalyticsData } from "@/types";

const AnalyticsCharts = dynamic(
  () => import("@/components/analytics/AnalyticsCharts"),
  {
    ssr: false,
    loading: () => <div className="h-64 animate-pulse rounded-xl bg-[var(--surface-muted)]" />,
  }
);

export default function AnalyticsPage() {
  const { user } = useUser();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeGroupId = user?.activeGroupId;

  const load = useCallback(async () => {
    if (!activeGroupId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await apiGet<AnalyticsData>("/api/analytics");
      setData(d);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [activeGroupId]);

  useEffect(() => { load(); }, [load]);

  if (user && !user.activeGroupId) {
    return (
      <EmptyState
        title="No active group"
        description="Analytics are available once you join or create a prep group."
        action={
          <Link href="/groups">
            <Button>Browse Groups</Button>
          </Link>
        }
      />
    );
  }

  if (loading) return <AnalyticsPageSkeleton />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--foreground)]">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">Preparation statistics and performance trends.</p>
      </div>

      <AnalyticsCharts data={data} currentUserId={user?._id} />
    </div>
  );
}
