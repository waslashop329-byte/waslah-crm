import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

interface RecordEventParams {
  customerId: string;
  eventType: string;
  title: string;
  description?: string | null;
  relatedOrderId?: string | null;
  relatedEmployeeId?: string | null;
  metadata?: Json;
}

// Uses the admin (service-role) client, not the RLS-scoped one: this gets
// called from webhook/sync contexts with no user session at all (Phase 3),
// where the RLS-scoped client would silently fail every insert (no session
// -> "anon" role -> no policy matches "to authenticated"). System writes are
// not something the acting user's own row-visibility should gate.
export async function recordCustomerEvent(params: RecordEventParams): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("customer_events").insert({
    customer_id: params.customerId,
    event_type: params.eventType,
    title: params.title,
    description: params.description ?? null,
    related_order_id: params.relatedOrderId ?? null,
    related_employee_id: params.relatedEmployeeId ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("Failed to record customer timeline event", { params, error });
  }
}
