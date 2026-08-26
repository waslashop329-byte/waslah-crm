import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { NotificationRow } from "@/lib/types/database";

export async function getUnreadNotificationCount(recipientId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", recipientId)
    .eq("is_read", false);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function listRecentNotifications(recipientId: string, limit = 15): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
