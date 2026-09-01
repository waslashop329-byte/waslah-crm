import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Recomputed from the orders table every time, never incremented — so
// re-running a sync (retries, duplicate webhooks) can never drift the
// numbers. This is always a pure function of the order rows that currently
// exist for the customer.
export async function recalculateCustomerStats(customerId: string): Promise<void> {
  const supabase = createAdminClient();

  const [{ data: orders, error }, { data: customer, error: customerError }] = await Promise.all([
    supabase.from("orders").select("status, total_amount, ordered_at").eq("customer_id", customerId),
    supabase.from("customers").select("customer_since").eq("id", customerId).single(),
  ]);

  if (error) {
    throw new Error(`Failed to load orders for stats recalculation: ${error.message}`);
  }
  if (customerError) {
    throw new Error(`Failed to load customer for stats recalculation: ${customerError.message}`);
  }

  const rows = orders ?? [];
  const delivered = rows.filter((o) => o.status === "delivered");
  const cancelled = rows.filter((o) => o.status === "cancelled");
  const returned = rows.filter((o) => o.status === "returned");
  const totalSpend = delivered.reduce((sum, o) => sum + Number(o.total_amount), 0);
  const orderedTimestamps = rows.map((o) => new Date(o.ordered_at).getTime()).sort((a, b) => a - b);
  const firstOrderAt = orderedTimestamps.length > 0 ? new Date(orderedTimestamps[0]) : null;

  // customer_since defaults to the row's own creation time (DB default
  // `now()`) whenever a provider gives no reliable "first order" date at
  // insert time — found live against real data: 1577 of 1913 real customers
  // (82%) had customer_since stamped to whenever we happened to sync them,
  // not a real date, silently inflating "New customers (30d)" and skewing
  // retention/cohort math. A real order is hard evidence of when a customer
  // actually started; correct customer_since here, every sync, whenever
  // that evidence predates the currently stored value — self-healing for
  // every customer this runs for, without needing a one-off migration to
  // stay correct going forward.
  const customerSince = customer?.customer_since ? new Date(customer.customer_since) : null;
  const correctedSince = firstOrderAt && (!customerSince || firstOrderAt < customerSince) ? firstOrderAt.toISOString() : undefined;

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      total_orders: rows.length,
      delivered_orders: delivered.length,
      cancelled_orders: cancelled.length,
      returned_orders: returned.length,
      total_spend: totalSpend,
      avg_order_value: delivered.length > 0 ? totalSpend / delivered.length : 0,
      first_order_at: firstOrderAt ? firstOrderAt.toISOString() : null,
      last_order_at: orderedTimestamps.length > 0 ? new Date(orderedTimestamps[orderedTimestamps.length - 1]).toISOString() : null,
      ...(correctedSince ? { customer_since: correctedSince } : {}),
    })
    .eq("id", customerId);

  if (updateError) {
    throw new Error(`Failed to update customer stats: ${updateError.message}`);
  }
}
