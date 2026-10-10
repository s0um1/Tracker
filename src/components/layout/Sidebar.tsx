"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ExternalLink } from "lucide-react";
import { useUser } from "@/components/providers/UserProvider";
import AppLogo from "@/components/ui/AppLogo";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { openCareerFlow } from "@/lib/apps-client";
import { buildMainNav, isExternalNavItem, isNavItemActive } from "./nav-config";

const navItemClass = (active: boolean) =>
  clsx(
    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    active
      ? "bg-brand/10 text-brand"
      : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
  );

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useUser();
  const nav = buildMainNav(user?.activeGroupId);

  return (
    <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:flex">
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b border-[var(--border)] px-5">
        <AppLogo size="sm" />
        <div className="text-sm font-bold text-[var(--foreground)]">GrowthHub</div>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-3">
        {nav.map((item) => {
          const active = !isExternalNavItem(item) && isNavItemActive(pathname, item.href);
          const Icon = item.icon;

          if (isExternalNavItem(item)) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openCareerFlow()}
                className={navItemClass(false)}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} />
                <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
              </button>
            );
          }

          return (
            <Link key={item.id} href={item.href} className={navItemClass(active)}>
              <Icon
                className="h-[18px] w-[18px] shrink-0"
                strokeWidth={active ? 2.25 : 1.75}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-[var(--border)] p-4">
        <ThemeToggle className="mb-3 w-full justify-center" showLabel />
        {user && (
          <>
            <div className="text-sm font-medium text-[var(--foreground)]">{user.name}</div>
            <div className="text-xs text-[var(--muted)]">
              {user.username ? `@${user.username}` : user.email || "Shared account"}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
