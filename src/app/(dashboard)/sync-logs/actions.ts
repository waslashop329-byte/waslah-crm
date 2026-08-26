"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { processWebhookEvent } from "@/lib/integrations/webhooks/processor";
import { recordAudit } from "@/lib/services/audit-service";

const eventIdSchema = z.object({ eventId: z.string().uuid() });

export interface RetryActionState {
  error?: string;
  success?: boolean;
}

export async function retryWebhookEventAction(_prevState: RetryActionState, formData: FormData): Promise<RetryActionState> {
  const user = await requirePermission("integrations.manage");

  const parsed = eventIdSchema.safeParse({ eventId: formData.get("eventId") });
  if (!parsed.success) return { error: "Invalid event" };

  const result = await processWebhookEvent(parsed.data.eventId);

  await recordAudit({
    actorId: user.userId,
    action: "webhook_event.manual_retry",
    entityType: "webhook_event",
    entityId: parsed.data.eventId,
    afterData: { status: result.status, error: result.error ?? null },
  });

  revalidatePath("/sync-logs");

  if (result.status === "failed") {
    return { error: result.error ?? "Retry failed" };
  }
  return { success: true };
}
