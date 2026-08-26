"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { globalSearchAction } from "@/app/(dashboard)/search-actions";
import type { QuickSearchResult } from "@/lib/repositories/customer-repository";

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  inactive: "bg-muted text-muted-foreground",
  blocked: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  merged: "bg-muted text-muted-foreground",
};

export function GlobalSearchBox() {
  const router = useRouter();
  const t = useTranslations("topbar");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<QuickSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trimmed = query.trim();

    const handle = setTimeout(() => {
      if (trimmed.length < 2) {
        setResults([]);
        setSearched(false);
        setOpen(false);
        return;
      }

      startTransition(async () => {
        const data = await globalSearchAction(trimmed);
        setResults(data);
        setSearched(true);
        setOpen(true);
      });
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(customerId: string) {
    setOpen(false);
    setQuery("");
    router.push(`/customers/${customerId}`);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={t("searchPlaceholder")}
        className="ps-8"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (searched) setOpen(true);
        }}
      />
      {open ? (
        <div className="absolute top-full z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md">
          {isPending ? (
            <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {t("searching")}
            </div>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-muted-foreground">{t("noSearchResults")}</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((customer) => (
                <li key={customer.id}>
                  <button
                    type="button"
                    onClick={() => goTo(customer.id)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{customer.full_name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[customer.primary_phone, customer.email].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Badge variant="outline" className={`shrink-0 border-transparent text-[10px] ${STATUS_STYLES[customer.status] ?? ""}`}>
                      {t(`searchStatus.${customer.status}`)}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
