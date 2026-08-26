"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { TagRow } from "@/lib/types/database";

const STATUS_OPTIONS = ["active", "inactive", "blocked", "merged"] as const;

export function CustomersToolbar({ tags }: { tags: TagRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  const t = useTranslations("customers.toolbar");

  const SORT_OPTIONS: { value: string; label: string }[] = [
    { value: "last_order_at:desc", label: t("sort.lastOrderDesc") },
    { value: "last_order_at:asc", label: t("sort.lastOrderAsc") },
    { value: "total_spend:desc", label: t("sort.totalSpendDesc") },
    { value: "total_orders:desc", label: t("sort.totalOrdersDesc") },
    { value: "score:desc", label: t("sort.scoreDesc") },
    { value: "score:asc", label: t("sort.scoreAsc") },
    { value: "customer_since:desc", label: t("sort.customerSinceDesc") },
    { value: "customer_since:asc", label: t("sort.customerSinceAsc") },
  ];

  const STATUS_LABELS: Record<(typeof STATUS_OPTIONS)[number], string> = {
    active: t("statusActive"),
    inactive: t("statusInactive"),
    blocked: t("statusBlocked"),
    merged: t("statusMerged"),
  };

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }
      params.delete("page");
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchValue !== (searchParams.get("q") ?? "")) {
        pushParams({ q: searchValue || null });
      }
    }, 350);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchValue]);

  const activeTagIds = new Set((searchParams.get("tags") ?? "").split(",").filter(Boolean));
  const currentSort = `${searchParams.get("sort") ?? "last_order_at"}:${searchParams.get("dir") ?? "desc"}`;

  const filterCount = [
    "minOrders",
    "minDelivered",
    "minCancelled",
    "scoreMin",
    "scoreMax",
    "lastOrderAfter",
    "createdAfter",
    "status",
    "tags",
  ].filter((key) => searchParams.get(key)).length;

  function toggleTag(tagId: string) {
    const next = new Set(activeTagIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    pushParams({ tags: next.size > 0 ? Array.from(next).join(",") : null });
  }

  function resetFilters() {
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-xs flex-1">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          className="ps-8"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <SlidersHorizontal className="size-3.5" />
            {t("filters")}
            {filterCount > 0 ? (
              <Badge variant="secondary" className="ms-1 h-4 min-w-4 px-1 text-[10px]">
                {filterCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("status")}</Label>
            <Select
              value={searchParams.get("status") ?? "any"}
              onValueChange={(value) => pushParams({ status: value === "any" ? null : value })}
            >
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("anyStatus")}</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">{t("tags")}</Label>
            <div className="grid max-h-32 grid-cols-2 gap-1.5 overflow-y-auto">
              {tags.map((tag) => (
                <label key={tag.id} className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={activeTagIds.has(tag.id)} onCheckedChange={() => toggleTag(tag.id)} />
                  {tag.name}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("minOrders")}</Label>
              <Input
                type="number"
                min={0}
                className="h-8"
                defaultValue={searchParams.get("minOrders") ?? ""}
                onBlur={(e) => pushParams({ minOrders: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("minDelivered")}</Label>
              <Input
                type="number"
                min={0}
                className="h-8"
                defaultValue={searchParams.get("minDelivered") ?? ""}
                onBlur={(e) => pushParams({ minDelivered: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("minCancelled")}</Label>
              <Input
                type="number"
                min={0}
                className="h-8"
                defaultValue={searchParams.get("minCancelled") ?? ""}
                onBlur={(e) => pushParams({ minCancelled: e.target.value || null })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("scoreMin")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-8"
                defaultValue={searchParams.get("scoreMin") ?? ""}
                onBlur={(e) => pushParams({ scoreMin: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("scoreMax")}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-8"
                defaultValue={searchParams.get("scoreMax") ?? ""}
                onBlur={(e) => pushParams({ scoreMax: e.target.value || null })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("lastOrderAfter")}</Label>
              <Input
                type="date"
                className="h-8"
                defaultValue={searchParams.get("lastOrderAfter") ?? ""}
                onChange={(e) => pushParams({ lastOrderAfter: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("customerSince")}</Label>
              <Input
                type="date"
                className="h-8"
                defaultValue={searchParams.get("createdAfter") ?? ""}
                onChange={(e) => pushParams({ createdAfter: e.target.value || null })}
              />
            </div>
          </div>

          {filterCount > 0 ? (
            <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={resetFilters}>
              <X className="size-3.5" />
              {t("clearFilters")}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>

      <Select value={currentSort} onValueChange={(value) => {
        const [sort, dir] = value.split(":");
        pushParams({ sort, dir });
      }}>
        <SelectTrigger size="sm" className="ms-auto w-56">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isPending ? <span className="text-xs text-muted-foreground">{t("updating")}</span> : null}
    </div>
  );
}
