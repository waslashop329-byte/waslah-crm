import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number;
  icon: LucideIcon;
  tone?: "default" | "warning" | "danger" | "success";
  suffix?: string;
  /** When set, the whole card links to the underlying data behind this number (e.g. the filtered customer or order list). */
  href?: string;
}

const TONE_STYLES: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
};

export function KpiCard({ label, value, icon: Icon, tone = "default", suffix, href }: KpiCardProps) {
  const card = (
    <Card className={cn("gap-2 py-4", href ? "transition-colors hover:border-primary/50 hover:bg-accent/40" : undefined)}>
      <CardHeader className="flex-row items-center justify-between px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={cn("size-4", TONE_STYLES[tone])} />
      </CardHeader>
      <CardContent className="px-4">
        <p className={cn("text-2xl font-semibold tabular-nums", TONE_STYLES[tone])}>
          {value.toLocaleString("en-US")}
          {suffix ? <span className="text-base">{suffix}</span> : null}
        </p>
      </CardContent>
    </Card>
  );

  if (!href) return card;

  return (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {card}
    </Link>
  );
}
