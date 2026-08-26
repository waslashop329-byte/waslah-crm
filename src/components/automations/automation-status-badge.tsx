import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AutomationExecutionStatus } from "@/lib/types/database";

const STATUS_STYLES: Record<AutomationExecutionStatus, string> = {
  pending: "bg-muted text-muted-foreground",
  running: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  failed: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  skipped: "bg-muted text-muted-foreground",
};

export async function ExecutionStatusBadge({ status }: { status: AutomationExecutionStatus }) {
  const t = await getTranslations("automations.executionStatus");

  return (
    <Badge variant="outline" className={cn("border-transparent font-medium capitalize", STATUS_STYLES[status])}>
      {t(status)}
    </Badge>
  );
}
