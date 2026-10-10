"use client";

export function getCareerFlowAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_CAREERFLOW_URL ||
    process.env.NEXT_PUBLIC_JOB_TRACKER_URL ||
    "http://localhost:3000"
  );
}

function navigateAway(url: string) {
  // Cross-origin SSO handoff — must be a full document navigation, not Next.js router.
  window.location.href = url;
}

export async function openCareerFlow(): Promise<void> {
  const careerFlowUrl = getCareerFlowAppUrl();
  try {
    const res = await fetch("/api/auth/sso-session", { credentials: "include" });
    if (res.ok) {
      const body = await res.json();
      if (body.data?.session) {
        navigateAway(
          `${careerFlowUrl}/auth/callback?session=${encodeURIComponent(body.data.session)}`
        );
        return;
      }
    }
  } catch {
    // fall through
  }
  navigateAway(careerFlowUrl);
}

export function googleLoginUrl(): string {
  return "/api/auth/google";
}
