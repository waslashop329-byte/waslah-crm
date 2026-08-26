import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SyncRunStatus } from "@/lib/types/database";

const STATUS_STYLES: Record<SyncRunStatus, string> = {
  queued: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  partially_failed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const STATUS_KEYS: Record<SyncRunStatus, string> = {
  queued: "queued",
  running: "running",
  completed: "completed",
  partially_failed: "partiallyFailed",
  failed: "failed",
};

export async function SyncRunStatusBadge({ status }: { status: SyncRunStatus }) {
  const t = await getTranslations("syncLogsPage.status");

  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", STATUS_STYLES[status])}>
      {t(STATUS_KEYS[status])}
    </Badge>
  );
}
