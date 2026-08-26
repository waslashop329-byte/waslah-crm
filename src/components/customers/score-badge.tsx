import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScoreCategory } from "@/lib/types/database";

const CATEGORY_STYLES: Record<ScoreCategory, string> = {
  excellent: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  trusted: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  medium_risk: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  high_risk: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export function ScoreBadge({ score, category }: { score: number; category: ScoreCategory }) {
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium tabular-nums", CATEGORY_STYLES[category])}>
      {score}
    </Badge>
  );
}
