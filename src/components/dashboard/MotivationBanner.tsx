"use client";

import { useUser } from "@/components/providers/UserProvider";
import InspirationCard from "@/components/dashboard/InspirationCard";

interface MotivationBannerProps {
  studyStreak?: number;
  daysToInterview?: number;
  targetCtcLpa?: number;
}

/** Context-aware motivation using user profile when dashboard stats aren't loaded. */
export default function MotivationBanner({
  studyStreak,
  daysToInterview = 30,
  targetCtcLpa,
}: MotivationBannerProps) {
  const { user } = useUser();

  return (
    <InspirationCard
      studyStreak={studyStreak ?? user?.studyStreak ?? 0}
      daysToInterview={daysToInterview}
      targetCtcLpa={targetCtcLpa ?? user?.targetCtcLpa}
    />
  );
}
