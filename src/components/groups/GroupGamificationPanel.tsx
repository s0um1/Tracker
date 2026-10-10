"use client";

import Card, { CardHeader } from "@/components/ui/Card";
import StudyHoursChart from "@/components/analytics/d3/StudyHoursChart";
import GroupLeaderboardChart from "@/components/groups/GroupLeaderboardChart";
import type { GroupGamification } from "@/types";

export default function GroupGamificationPanel({
  gamification,
}: {
  gamification: GroupGamification;
}) {
  const maxPoints = gamification.leaderboard[0]?.totalPoints ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="!p-4">
        <CardHeader title="Leaderboard" subtitle="Points from group questions" />
        <GroupLeaderboardChart members={gamification.leaderboard} maxPoints={maxPoints} />
      </Card>

      <Card className="!p-4">
        <CardHeader title="Points this week" subtitle="Group total per day" />
        <div className="h-52">
          <StudyHoursChart
            data={gamification.dailyPoints.map((d) => ({
              label: d.label,
              value: d.points,
              date: d.date,
            }))}
            color="var(--accent)"
            valueSuffix="pts"
          />
        </div>
      </Card>
    </div>
  );
}
