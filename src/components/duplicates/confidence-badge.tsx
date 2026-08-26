import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tone =
    confidence >= 70
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : confidence >= 40
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("border-transparent font-medium tabular-nums", tone)}>
      {Math.round(confidence)}%
    </Badge>
  );
}
