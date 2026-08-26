import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

interface PhasePlaceholderProps {
  title: string;
  icon: LucideIcon;
  phase: number;
  summary: string;
}

export function PhasePlaceholder({ title, icon, phase, summary }: PhasePlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{summary}</p>
      </div>
      <EmptyState icon={icon} title={`Ships in Phase ${phase}`} description={summary} />
    </div>
  );
}
