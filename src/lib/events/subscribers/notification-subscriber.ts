import "server-only";
import { subscribe } from "@/lib/events/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/services/notification-service";

// "High-risk customer detected" (Part 17) — fires only on the transition
// *into* high risk (risk-service.ts already only dispatches this event when
// the category actually changed), not on every recalculation that happens
// to still be high.
export function registerNotificationSubscriber(): void {
  subscribe("customer.risk_changed", async ({ customerId }) => {
    const supabase = createAdminClient();

    const [{ data: profile }, { data: customer }] = await Promise.all([
      supabase.from("customer_risk_profiles").select("overall_risk_category").eq("customer_id", customerId).maybeSingle(),
      supabase.from("customers").select("assigned_to, full_name").eq("id", customerId).maybeSingle(),
    ]);

    if (profile?.overall_risk_category !== "high" || !customer?.assigned_to) return;

    await createNotification({
      recipientId: customer.assigned_to,
      type: "high_risk_customer",
      title: "High-risk customer detected",
      message: `${customer.full_name} is now flagged as high risk.`,
      relatedEntityType: "customer",
      relatedEntityId: customerId,
    });
  });
}
