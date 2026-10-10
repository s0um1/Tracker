import type { Dispatch, SetStateAction } from "react";

export type QuestionPointBurst = { id: string; points: number };

export function triggerQuestionPointsBurst(
  setBurst: Dispatch<SetStateAction<QuestionPointBurst | null>>,
  id: string,
  pointsEarnedNow?: number
) {
  if (pointsEarnedNow == null || pointsEarnedNow <= 0) return;
  setBurst({ id, points: pointsEarnedNow });
  window.setTimeout(() => {
    setBurst((current) => (current?.id === id ? null : current));
  }, 900);
}
