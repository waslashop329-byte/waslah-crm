import "server-only";
import { subscribe } from "@/lib/events/dispatcher";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrollCustomerInCampaign } from "@/lib/services/campaign-service";

// Phase 16 (growth roadmap): auto-enrolls a customer into every active
// order_delivered campaign the moment their order is marked delivered — the
// "post-purchase sequence" trigger. The other trigger type
// (customer_inactive, win-back) isn't event-driven — it's scanned daily by
// the maintenance cron instead, since "N days since last order" isn't a
// discrete moment anything dispatches an event for.
export function registerCampaignSubscriber(): void {
  subscribe("order.delivered", async ({ orderId, customerId }) => {
    const supabase = createAdminClient();
    const { data: campaigns } = await supabase.from("campaigns").select("id").eq("trigger_type", "order_delivered").eq("is_active", true);

    for (const campaign of campaigns ?? []) {
      await enrollCustomerInCampaign(campaign.id, customerId, orderId);
    }
  });
}
