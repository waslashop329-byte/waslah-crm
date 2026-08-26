import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Recomputed from the orders table every time, never incremented — so
// re-running a sync (retries, duplicate webhooks) can never drift the
// numbers. This is always a pure function of the order rows that currently
// exist for the customer.
export async function recalculateCustomerStats(customerId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: orders, error } = await supabase.from("orders").select("status, total_amount, ordered_at").eq("customer_id", customerId);

  if (error) {
    throw new Error(`Failed to load orders for stats recalculation: ${error.message}`);
  }

  const rows = orders ?? [];
  const delivered = rows.filter((o) => o.status === "delivered");
  const cancelled = rows.filter((o) => o.status === "cancelled");
  const returned = rows.filter((o) => o.status === "returned");
  const totalSpend = delivered.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const orderedTimestamps = rows.map((o) => new Date(o.ordered_at).getTime()).sort((a, b) => a - b);

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      total_orders: rows.length,
      delivered_orders: delivered.length,
      cancelled_orders: cancelled.length,
      returned_orders: returned.length,
      total_spend: totalSpend,
      avg_order_value: delivered.length > 0 ? totalSpend / delivered.length : 0,
      first_order_at: orderedTimestamps.length > 0 ? new Date(orderedTimestamps[0]).toISOString() : null,
      last_order_at: orderedTimestamps.length > 0 ? new Date(orderedTimestamps[orderedTimestamps.length - 1]).toISOString() : null,
    })
    .eq("id", customerId);

  if (updateError) {
    throw new Error(`Failed to update customer stats: ${updateError.message}`);
  }
}
