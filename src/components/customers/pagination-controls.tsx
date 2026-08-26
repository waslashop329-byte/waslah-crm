"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  page: number;
  pageSize: number;
  total: number;
  /** Translation namespace with showing/previous/next/pageOf/noResults keys. Defaults to the customers list's namespace. */
  translationNamespace?: string;
}

export function PaginationControls({ page, pageSize, total, translationNamespace = "customers.pagination" }: PaginationControlsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations(translationNamespace);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function hrefForPage(target: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(target));
    return `${pathname}?${params.toString()}`;
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="flex items-center justify-between border-t pt-3">
      <p className="text-xs text-muted-foreground">
        {total === 0 ? t("noResults") : t("showing", { from, to, total: total.toLocaleString() })}
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} asChild={page > 1}>
          {page > 1 ? (
            <Link href={hrefForPage(page - 1)}>
              <ChevronLeft className="size-3.5 rtl:rotate-180" />
              {t("previous")}
            </Link>
          ) : (
            <span>
              <ChevronLeft className="size-3.5 rtl:rotate-180" />
              {t("previous")}
            </span>
          )}
        </Button>
        <span className="text-xs text-muted-foreground">{t("pageOf", { page, totalPages })}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} asChild={page < totalPages}>
          {page < totalPages ? (
            <Link href={hrefForPage(page + 1)}>
              {t("next")}
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            </Link>
          ) : (
            <span>
              {t("next")}
              <ChevronRight className="size-3.5 rtl:rotate-180" />
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
