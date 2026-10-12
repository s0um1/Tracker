"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { ExternalLink, Menu, X } from "lucide-react";
import { useUser } from "@/components/providers/UserProvider";
import { openCareerFlow } from "@/lib/apps-client";
import { buildMobileNav, buildMobileMoreNav, isExternalNavItem, isNavItemActive } from "./nav-config";

export default function MobileNav() {
  const pathname = usePathname();
  const { user } = useUser();
  const nav = buildMobileNav(user?.activeGroupId);
  const moreNav = buildMobileMoreNav(user?.activeGroupId);
  const [moreOpen, setMoreOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [moreOpen]);

  const moreActive = moreNav.some(
    (item) => !isExternalNavItem(item) && isNavItemActive(pathname, item.href)
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-lg lg:hidden">
      {moreOpen && (
        <div
          ref={menuRef}
          className="absolute inset-x-2 bottom-[calc(100%+0.5rem)] rounded-xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-panel"
        >
          <div className="grid grid-cols-3 gap-1">
            {moreNav.map((item) => {
              const active = !isExternalNavItem(item) && isNavItemActive(pathname, item.href);
              const Icon = item.icon;
              const itemClassName = clsx(
                "flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-medium transition-colors",
                active
                  ? "bg-brand/10 text-brand"
                  : "text-[var(--muted)] hover:bg-brand/10 hover:text-brand"
              );

              if (isExternalNavItem(item)) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMoreOpen(false);
                      openCareerFlow();
                    }}
                    className={itemClassName}
                  >
                    <span className="relative">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                      <ExternalLink
                        className="absolute -right-1 -top-1 h-2.5 w-2.5 opacity-60"
                        aria-hidden
                      />
                    </span>
                    {item.label}
                  </button>
                );
              }

              return (
                <Link key={item.id} href={item.href} className={itemClassName}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex items-center px-2 py-2">
        {nav.map((item) => {
          const active = !isExternalNavItem(item) && isNavItemActive(pathname, item.href);
          const Icon = item.icon;
          const className = clsx(
            "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors",
            active ? "bg-brand/10 text-brand" : "text-[var(--muted)]"
          );

          if (isExternalNavItem(item)) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openCareerFlow()}
                className={className}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                  <ExternalLink
                    className="absolute -right-1 -top-1 h-2.5 w-2.5 opacity-60"
                    aria-hidden
                  />
                </span>
                {item.shortLabel ?? item.label}
              </button>
            );
          }

          return (
            <Link key={item.id} href={item.href} className={className}>
              <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 1.75} />
              {item.shortLabel ?? item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          className={clsx(
            "flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors",
            moreOpen || moreActive ? "text-brand" : "text-[var(--muted)]"
          )}
          aria-expanded={moreOpen}
          aria-label="More navigation options"
        >
          {moreOpen ? (
            <X className="h-5 w-5" strokeWidth={2.25} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={moreActive ? 2.25 : 1.75} />
          )}
          More
        </button>
      </div>
    </nav>
  );
}
