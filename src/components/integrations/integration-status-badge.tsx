"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IntegrationStatus } from "@/lib/types/database";

const STATUS_STYLES: Record<IntegrationStatus, string> = {
  connected: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  disconnected: "bg-muted text-muted-foreground",
  error: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  not_configured: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
};

const STATUS_KEYS: Record<IntegrationStatus, string> = {
  connected: "connected",
  disconnected: "disconnected",
  error: "error",
  not_configured: "notConfigured",
};

export function IntegrationStatusBadge({ status }: { status: IntegrationStatus }) {
  const t = useTranslations("integrations.status");

  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", STATUS_STYLES[status])}>
      {t(STATUS_KEYS[status])}
    </Badge>
  );
}
