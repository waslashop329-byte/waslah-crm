"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav-config";

export function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const sectionKey = item.section ? `sections.${item.section}` : undefined;
        return (
          <div key={item.href}>
            {sectionKey && (
              <div className="mt-3 mb-1 px-3 text-xs font-semibold tracking-wide text-sidebar-foreground/50 uppercase first:mt-0">
                {t.has(sectionKey) ? t(sectionKey) : item.section}
              </div>
            )}
            <Link
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="size-[18px] shrink-0" />
              {t.has(item.key) ? t(item.key) : item.label}
            </Link>
          </div>
        );
      })}
    </>
  );
}

export function Sidebar() {
  const t = useTranslations("nav");

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground md:flex">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-sm font-semibold tracking-tight">{t("appName")}</span>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        <NavLinks />
      </nav>
    </aside>
  );
}
