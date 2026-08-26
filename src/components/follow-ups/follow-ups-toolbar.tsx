"use client";

import { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function FollowUpsToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations("followUpsPage.toolbar");

  function pushParams(updates: Record<string, string | null>) {
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
  }

  const filterCount = ["status", "overdueOnly"].filter((key) => searchParams.get(key)).length;

  function resetFilters() {
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
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
        <PopoverContent align="start" className="w-72 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("status")}</Label>
            <Select value={searchParams.get("status") ?? "any"} onValueChange={(value) => pushParams({ status: value === "any" ? null : value })}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("anyStatus")}</SelectItem>
                <SelectItem value="pending">{t("statusPending")}</SelectItem>
                <SelectItem value="completed">{t("statusCompleted")}</SelectItem>
                <SelectItem value="cancelled">{t("statusCancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              checked={searchParams.get("overdueOnly") === "true"}
              onCheckedChange={(checked) => pushParams({ overdueOnly: checked ? "true" : null })}
            />
            {t("overdueOnly")}
          </label>

          {filterCount > 0 ? (
            <Button variant="ghost" size="sm" className="w-full gap-1.5" onClick={resetFilters}>
              <X className="size-3.5" />
              {t("clearFilters")}
            </Button>
          ) : null}
        </PopoverContent>
      </Popover>

      {isPending ? <span className="text-xs text-muted-foreground">{t("updating")}</span> : null}
    </div>
  );
}
