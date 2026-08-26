import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHash } from "node:crypto";

// Exactly the shape Part 3 asks for — built entirely from existing tables,
// never a raw dump. Anything not in this object is a fact the AI cannot see
// and therefore cannot mention (grounding, Part 3/14).
export interface CustomerAiContext {
  customer: {
    name: string;
    email: string | null;
    customerSince: string;
    status: string;
    score: number;
    scoreCategory: string;
  };
  statistics: {
    totalOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
    returnedOrders: number;
    totalSpend: number;
    averageOrderValue: number;
  };
  risk: {
    cancellationRisk: number;
    deliveryRisk: number;
    returnRisk: number;
    overallRisk: number;
    overallCategory: string;
  } | null;
  tags: string[];
  recentOrders: { status: string; productSummary: string | null; totalAmount: number; orderedAt: string }[];
  recentEvents: { type: string; title: string | null; description: string | null; createdAt: string }[];
  pendingFollowUps: { title: string; dueDate: string; priority: string }[];
}

export async function buildCustomerAiContext(customerId: string): Promise<CustomerAiContext | null> {
  const supabase = createAdminClient();

  const [{ data: customer }, { data: tagRows }, { data: risk }, { data: orders }, { data: events }, { data: followUps }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", customerId).is("deleted_at", null).maybeSingle(),
    supabase.from("customer_tags").select("tags(name)").eq("customer_id", customerId).is("removed_at", null),
    supabase.from("customer_risk_profiles").select("*").eq("customer_id", customerId).maybeSingle(),
    supabase.from("orders").select("status, product_summary, total_amount, ordered_at").eq("customer_id", customerId).order("ordered_at", { ascending: false }).limit(10),
    supabase.from("customer_events").select("event_type, title, description, created_at").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(15),
    supabase.from("follow_ups").select("title, due_date, priority").eq("customer_id", customerId).eq("status", "pending").order("due_date", { ascending: true }).limit(5),
  ]);

  if (!customer) return null;

  const tags = (tagRows ?? []).map((row) => (row.tags as unknown as { name: string } | null)?.name).filter((name): name is string => Boolean(name));

  return {
    customer: {
      name: customer.full_name,
      email: customer.email,
      customerSince: customer.customer_since,
      status: customer.status,
      score: customer.score,
      scoreCategory: customer.score_category,
    },
    statistics: {
      totalOrders: customer.total_orders,
      deliveredOrders: customer.delivered_orders,
      cancelledOrders: customer.cancelled_orders,
      returnedOrders: customer.returned_orders,
      totalSpend: customer.total_spend,
      averageOrderValue: customer.avg_order_value,
    },
    risk: risk
      ? {
          cancellationRisk: risk.cancellation_risk,
          deliveryRisk: risk.delivery_risk,
          returnRisk: risk.return_risk,
          overallRisk: risk.overall_risk,
          overallCategory: risk.overall_risk_category,
        }
      : null,
    tags,
    recentOrders: (orders ?? []).map((order) => ({
      status: order.status,
      productSummary: order.product_summary,
      totalAmount: order.total_amount,
      orderedAt: order.ordered_at,
    })),
    recentEvents: (events ?? []).map((event) => ({
      type: event.event_type,
      title: event.title,
      description: event.description,
      createdAt: event.created_at,
    })),
    pendingFollowUps: (followUps ?? []).map((followUp) => ({
      title: followUp.title,
      dueDate: followUp.due_date,
      priority: followUp.priority,
    })),
  };
}

// Deterministic hash of the context (Part 4: "data snapshot hash") — used to
// detect whether a stored AI summary is still describing the customer's
// current state, without needing to compare every field by hand.
export function hashCustomerAiContext(context: CustomerAiContext): string {
  return createHash("sha256").update(JSON.stringify(context)).digest("hex");
}
