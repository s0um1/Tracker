"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@/components/providers/UserProvider";
import Sidebar from "./Sidebar";
import MobileNav from "./MobileNav";
import { AppShellSkeleton } from "@/components/ui/StateViews";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { getHomePath } from "@/lib/home";

const PUBLIC_PATHS = ["/login", "/register"];
const ONBOARDING_PATH = "/onboarding";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isOnboarding = pathname === ONBOARDING_PATH;

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublic) {
      router.replace("/login");
    } else if (user && isPublic) {
      router.replace(getHomePath(user));
    } else if (user && !user.onboardingComplete && !isOnboarding) {
      router.replace(ONBOARDING_PATH);
    } else if (user?.onboardingComplete && isOnboarding) {
      router.replace(getHomePath(user));
    }
  }, [user, loading, isPublic, isOnboarding, router]);

  if (loading && !isPublic && !isOnboarding) {
    return <AppShellSkeleton />;
  }

  if (isPublic || isOnboarding) {
    return <>{children}</>;
  }

  if (!user) return null;

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex shrink-0 justify-end px-4 pt-4 sm:px-6 lg:hidden">
          <ThemeToggle />
        </div>
        {user.isGuest && (
          <div className="mx-4 mb-2 shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm text-amber-800 sm:mx-6 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Demo mode — sample data across all tabs. Changes are shared with other demo visitors.
          </div>
        )}
        <main
          id="app-main"
          className="min-h-0 flex-1 overflow-y-auto px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8 lg:pt-8"
        >
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
