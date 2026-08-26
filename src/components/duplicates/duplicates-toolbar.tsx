"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { scanForDuplicatesAction, type DuplicateActionState } from "@/app/(dashboard)/duplicates/actions";

const initialState: DuplicateActionState = {};

export function DuplicatesToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("duplicates.toolbar");
  const [state, formAction, isPending] = useActionState(scanForDuplicatesAction, initialState);

  useEffect(() => {
    if (state.success) toast.success(state.message ?? t("scanComplete"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">{t("status")}</Label>
          <Select value={searchParams.get("status") ?? "pending"} onValueChange={(v) => pushParams({ status: v === "any" ? null : v })}>
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("anyStatus")}</SelectItem>
              <SelectItem value="pending">{t("statusPending")}</SelectItem>
              <SelectItem value="ignored">{t("statusIgnored")}</SelectItem>
              <SelectItem value="merged">{t("statusMerged")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">{t("confidence")}</Label>
          <Select value={searchParams.get("minConfidence") ?? "any"} onValueChange={(v) => pushParams({ minConfidence: v === "any" ? null : v })}>
            <SelectTrigger size="sm" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">{t("anyConfidence")}</SelectItem>
              <SelectItem value="70">{t("highConfidence")}</SelectItem>
              <SelectItem value="40">{t("mediumConfidence")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <form action={formAction}>
        <Button type="submit" variant="outline" size="sm" disabled={isPending} className="gap-1.5">
          <RefreshCw className={isPending ? "size-3.5 animate-spin" : "size-3.5"} />
          {isPending ? t("scanning") : t("scan")}
        </Button>
      </form>
    </div>
  );
}
