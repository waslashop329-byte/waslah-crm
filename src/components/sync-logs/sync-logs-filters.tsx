"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

const STATUS_OPTIONS = ["queued", "running", "completed", "partially_failed", "failed"];

const STATUS_KEYS: Record<string, string> = {
  queued: "queued",
  running: "running",
  completed: "completed",
  partially_failed: "partiallyFailed",
  failed: "failed",
};

interface SyncLogsFiltersProps {
  integrations: { id: string; name: string }[];
}

export function SyncLogsFilters({ integrations }: SyncLogsFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("syncLogsPage.filters");
  const tStatus = useTranslations("syncLogsPage.status");

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const hasFilters = ["integration", "status", "dateFrom", "dateTo"].some((key) => searchParams.get(key));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1.5">
        <Label className="text-xs">{t("integration")}</Label>
        <Select value={searchParams.get("integration") ?? "any"} onValueChange={(v) => pushParams({ integration: v === "any" ? null : v })}>
          <SelectTrigger size="sm" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">{t("anyIntegration")}</SelectItem>
            {integrations.map((integration) => (
              <SelectItem key={integration.id} value={integration.id}>
                {integration.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("status")}</Label>
        <Select value={searchParams.get("status") ?? "any"} onValueChange={(v) => pushParams({ status: v === "any" ? null : v })}>
          <SelectTrigger size="sm" className="w-40">
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

      <div className="space-y-1.5">
        <Label className="text-xs">{t("from")}</Label>
        <Input
          type="date"
          className="h-8 w-36"
          defaultValue={searchParams.get("dateFrom") ?? ""}
          onChange={(e) => pushParams({ dateFrom: e.target.value || null })}
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">{t("to")}</Label>
        <Input
          type="date"
          className="h-8 w-36"
          defaultValue={searchParams.get("dateTo") ?? ""}
          onChange={(e) => pushParams({ dateTo: e.target.value || null })}
        />
      </div>

      {hasFilters ? (
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => router.push(pathname)}>
          <X className="size-3.5" />
          {t("clear")}
        </Button>
      ) : null}
    </div>
  );
}
