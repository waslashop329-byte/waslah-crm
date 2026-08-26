import "server-only";
import { createClient } from "@/lib/supabase/server";
import { calculateWinbackStage, type WinbackStage } from "@/lib/intelligence/loyalty/winback-stages";

export interface WinbackCandidate {
  customerId: string;
  fullName: string;
  lastOrderAt: string;
  daysSinceLastOrder: number;
  stage: WinbackStage;
}

// Manual candidate list, not an automated campaign — this CRM has no
// scheduled-job/cron mechanism yet (the automation engine is purely
// event-reactive), so staged win-back messaging is ops clicking "Send" here,
// not something that fires on its own. A real scheduler is future work.
export async function getWinbackCandidates(): Promise<WinbackCandidate[]> {
  const supabase = await createClient();
  const now = Date.now();

  const { data, error } = await supabase
    .from("customers")
    .select("id, full_name, last_order_at")
    .is("deleted_at", null)
    .not("last_order_at", "is", null)
    .lte("last_order_at", new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString());

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((c) => {
      const daysSinceLastOrder = Math.floor((now - new Date(c.last_order_at!).getTime()) / (24 * 60 * 60 * 1000));
      const stage = calculateWinbackStage(daysSinceLastOrder);
      return stage ? { customerId: c.id, fullName: c.full_name, lastOrderAt: c.last_order_at!, daysSinceLastOrder, stage } : null;
    })
    .filter((c): c is WinbackCandidate => c !== null)
    .sort((a, b) => b.daysSinceLastOrder - a.daysSinceLastOrder);
}
