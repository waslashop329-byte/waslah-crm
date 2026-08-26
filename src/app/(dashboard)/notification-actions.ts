"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export interface NotificationActionState {
  error?: string;
  success?: boolean;
}

const notificationIdSchema = z.object({ notificationId: z.string().uuid() });

export async function markNotificationReadAction(_prevState: NotificationActionState, formData: FormData): Promise<NotificationActionState> {
  const user = await requireUser();

  const parsed = notificationIdSchema.safeParse({ notificationId: formData.get("notificationId") });
  if (!parsed.success) return { error: "Invalid notification" };

  const supabase = await createClient();
  // RLS already scopes this to the caller's own notifications (recipient_id = auth.uid()).
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", parsed.data.notificationId).eq("recipient_id", user.userId);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionState> {
  const user = await requireUser();

  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ is_read: true }).eq("recipient_id", user.userId).eq("is_read", false);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
