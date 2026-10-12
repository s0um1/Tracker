import {
  LayoutDashboard,
  CircleHelp,
  ListChecks,
  Users,
  TrendingUp,
  Settings,
  BookOpen,
  Briefcase,
  Mic,
  type LucideIcon,
} from "lucide-react";

export const EXTERNAL_CAREERFLOW_HREF = "__external:careerflow";

export type NavItem = {
  id: string;
  href: string;
  label: string;
  shortLabel?: string;
  icon: LucideIcon;
  external?: boolean;
};

export function isExternalNavItem(item: NavItem): boolean {
  return item.external === true || item.href.startsWith("__external:");
}

/** Group overview is exact-match only so mock-interviews doesn't light up both items. */
export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/groups") return pathname === "/groups";
  if (/^\/groups\/[^/]+\/mock-interviews$/.test(href)) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  if (/^\/groups\/[^/]+$/.test(href)) return pathname === href;
  if (href === "/dashboard") return pathname === href || pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getGroupNavHref(activeGroupId?: string): string {
  return activeGroupId ? `/groups/${activeGroupId}` : "/groups";
}

export function getMockInterviewsNavHref(activeGroupId?: string): string {
  return activeGroupId ? `/groups/${activeGroupId}/mock-interviews` : "/groups";
}

export function buildMainNav(activeGroupId?: string): NavItem[] {
  const nav: NavItem[] = [
    { id: "dashboard", href: "/dashboard", label: "Dashboard", shortLabel: "Dashboard", icon: LayoutDashboard },
  ];

  if (activeGroupId) {
    nav.push(
      { id: "group", href: `/groups/${activeGroupId}`, label: "Group", shortLabel: "Group", icon: Users },
      {
        id: "mock-interviews",
        href: `/groups/${activeGroupId}/mock-interviews`,
        label: "Mock Interviews",
        shortLabel: "Mocks",
        icon: Mic,
      }
    );
  }

  nav.push(
    { id: "questions", href: "/questions", label: "Questions", icon: CircleHelp },
    { id: "subjects", href: "/subjects", label: "Tracks", icon: BookOpen },
    { id: "tasks", href: "/tasks", label: "Tasks", icon: ListChecks },
    {
      id: "groups",
      href: "/groups",
      label: activeGroupId ? "All Groups" : "Groups",
      icon: Users,
    },
    { id: "analytics", href: "/analytics", label: "Analytics", icon: TrendingUp },
    {
      id: "careerflow",
      href: EXTERNAL_CAREERFLOW_HREF,
      label: "CareerFlow",
      shortLabel: "Jobs",
      icon: Briefcase,
      external: true,
    },
    { id: "settings", href: "/settings", label: "Settings", shortLabel: "More", icon: Settings }
  );

  return nav;
}

export const MAIN_NAV: NavItem[] = buildMainNav();

const MOBILE_PRIMARY_HREFS = ["/dashboard", "/questions", "/tasks", EXTERNAL_CAREERFLOW_HREF];

export function buildMobileNav(activeGroupId?: string): NavItem[] {
  const nav = buildMainNav(activeGroupId);
  return nav.filter((item) => MOBILE_PRIMARY_HREFS.includes(item.href));
}

export function buildMobileMoreNav(activeGroupId?: string): NavItem[] {
  const nav = buildMainNav(activeGroupId);
  return nav.filter((item) => !MOBILE_PRIMARY_HREFS.includes(item.href));
}

export const MOBILE_NAV = buildMobileNav();
