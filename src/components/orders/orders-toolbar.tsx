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
import type { OrderStatus } from "@/lib/types/database";

const STATUS_OPTIONS: OrderStatus[] = ["new", "pending", "confirmed", "processing", "shipped", "delivered", "cancelled", "returned", "failed_delivery"];

const STATUS_KEYS: Record<OrderStatus, string> = {
  new: "statusNew",
  pending: "statusPending",
  confirmed: "statusConfirmed",
  processing: "statusProcessing",
  shipped: "statusShipped",
  delivered: "statusDelivered",
  cancelled: "statusCancelled",
  returned: "statusReturned",
  failed_delivery: "statusFailedDelivery",
};

export function OrdersToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");
  const t = useTranslations("ordersPage.toolbar");
  const tStatus = useTranslations("customerProfile.orders");

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

  const filterCount = ["status", "orderedAfter", "orderedBefore", "assignedOnly"].filter((key) => searchParams.get(key)).length;

  function resetFilters() {
    router.push(pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative max-w-xs flex-1">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t("searchPlaceholder")} className="ps-8" value={searchValue} onChange={(e) => setSearchValue(e.target.value)} />
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
            <Select value={searchParams.get("status") ?? "any"} onValueChange={(value) => pushParams({ status: value === "any" ? null : value })}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">{t("anyStatus")}</SelectItem>
                {STATUS_OPTIONS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {tStatus(STATUS_KEYS[status])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs">{t("orderedAfter")}</Label>
              <Input
                type="date"
                className="h-8"
                defaultValue={searchParams.get("orderedAfter") ?? ""}
                onChange={(e) => pushParams({ orderedAfter: e.target.value || null })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("orderedBefore")}</Label>
              <Input
                type="date"
                className="h-8"
                defaultValue={searchParams.get("orderedBefore") ?? ""}
                onChange={(e) => pushParams({ orderedBefore: e.target.value || null })}
              />
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-xs">
            <Checkbox
              checked={searchParams.get("assignedOnly") === "true"}
              onCheckedChange={(checked) => pushParams({ assignedOnly: checked ? "true" : null })}
            />
            {t("assignedOnly")}
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
