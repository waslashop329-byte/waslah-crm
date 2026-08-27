import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { recordAudit } from "@/lib/services/audit-service";
import { dispatchEvent } from "@/lib/events/dispatcher";
import { ORDER_STATUS_EVENT } from "@/lib/events/event-types";
import { distributeOrdersByLoad, type AgentLoad } from "@/lib/intelligence/confirmation/auto-assignment";
import type { CallAttemptResult, OrderCallAttemptRow, OrderRow } from "@/lib/types/database";

export async function assignOrder(actorId: string, orderId: string, agentId: string | null): Promise<OrderRow> {
  const supabase = await createClient();
  const { data: before } = await supabase.from("orders").select("assigned_to").eq("id", orderId).single();

  const { data: order, error } = await supabase.from("orders").update({ assigned_to: agentId }).eq("id", orderId).select().single();
  if (error || !order) throw new Error(error?.message ?? "Failed to assign order");

  await recordAudit({
    actorId,
    action: "order.assigned",
    entityType: "order",
    entityId: orderId,
    beforeData: before ? { assigned_to: before.assigned_to } : null,
    afterData: { assigned_to: agentId },
  });

  return order;
}

// Distributes every currently-unassigned pending/new order across active
// employees, least-loaded first (Phase 14's "auto-assignment" ask) — one
// click instead of assigning orders one by one. Reuses assignOrder() per
// order so every assignment still gets the same audit-log entry a manual
// assignment would.
export async function autoAssignUnassignedOrders(actorId: string): Promise<{ assignedCount: number; perAgent: Record<string, number> }> {
  const supabase = await createClient();

  const { data: employees, error: employeesError } = await supabase.from("profiles").select("id").eq("is_active", true);
  if (employeesError) throw new Error(employeesError.message);
  if (!employees || employees.length === 0) return { assignedCount: 0, perAgent: {} };

  const { data: openOrders, error: openOrdersError } = await supabase
    .from("orders")
    .select("assigned_to")
    .not("assigned_to", "is", null)
    .in("status", ["new", "pending"]);
  if (openOrdersError) throw new Error(openOrdersError.message);

  const loadByAgent = new Map<string, number>(employees.map((e) => [e.id, 0]));
  for (const order of openOrders ?? []) {
    if (order.assigned_to) loadByAgent.set(order.assigned_to, (loadByAgent.get(order.assigned_to) ?? 0) + 1);
  }
  const initialLoads: AgentLoad[] = employees.map((e) => ({ agentId: e.id, load: loadByAgent.get(e.id) ?? 0 }));

  const { data: unassigned, error: unassignedError } = await supabase
    .from("orders")
    .select("id")
    .is("assigned_to", null)
    .in("status", ["new", "pending"])
    .order("ordered_at", { ascending: true });
  if (unassignedError) throw new Error(unassignedError.message);
  if (!unassigned || unassigned.length === 0) return { assignedCount: 0, perAgent: {} };

  const assignments = distributeOrdersByLoad(
    unassigned.map((o) => o.id),
    initialLoads,
  );

  const perAgent: Record<string, number> = {};
  for (const [orderId, agentId] of assignments) {
    await assignOrder(actorId, orderId, agentId);
    perAgent[agentId] = (perAgent[agentId] ?? 0) + 1;
  }

  return { assignedCount: assignments.size, perAgent };
}

// Result -> the order status it drives, matching the same vocabulary
// order-sync.ts already writes. Statuses outside this map (no_answer,
// reschedule, invalid_number) log the attempt but never change the order's
// status — a failed contact attempt is not itself a status transition.
const RESULT_TO_STATUS: Partial<Record<CallAttemptResult, OrderRow["status"]>> = {
  confirmed: "confirmed",
  cancelled: "cancelled",
};

// RLS-scoped (not the admin client): always a signed-in agent acting through
// a server action already gated by requirePermission("orders.confirm") — the
// order_call_attempts and orders RLS policies provide the same assignment-
// scoped gate as a second layer, same reasoning as product-service.ts.
export async function logCallAttempt(
  actorId: string,
  orderId: string,
  result: CallAttemptResult,
  notes: string | null,
  reasonCategory: string | null = null,
): Promise<OrderCallAttemptRow> {
  const supabase = await createClient();

  const { data: attempt, error } = await supabase
    .from("order_call_attempts")
    .insert({ order_id: orderId, agent_id: actorId, result, notes, reason_category: result === "cancelled" ? reasonCategory : null })
    .select()
    .single();

  if (error || !attempt) throw new Error(error?.message ?? "Failed to log call attempt");

  const { data: order } = await supabase.from("orders").select("customer_id, status").eq("id", orderId).single();

  const newStatus = RESULT_TO_STATUS[result];
  if (order && newStatus && order.status !== newStatus) {
    const timestampField = newStatus === "confirmed" ? "confirmed_at" : newStatus === "cancelled" ? "cancelled_at" : null;
    await supabase
      .from("orders")
      .update({ status: newStatus, ...(timestampField ? { [timestampField]: new Date().toISOString() } : {}) })
      .eq("id", orderId);

    const namedEvent = ORDER_STATUS_EVENT[newStatus];
    if (namedEvent) await dispatchEvent(namedEvent, { orderId, customerId: order.customer_id });
  }

  if (order) {
    await recordCustomerEvent({
      customerId: order.customer_id,
      eventType: "order.call_attempt",
      title: "Call attempt logged",
      description: `${result.replace("_", " ")}${notes ? ` — ${notes}` : ""}`,
      relatedOrderId: orderId,
      relatedEmployeeId: actorId,
    });
  }

  return attempt;
}
