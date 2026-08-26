import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchEvent } from "@/lib/events/dispatcher";
import type { RiskLevel, RiskType } from "@/lib/types/database";

const SHIPPED_STATUSES = new Set(["shipped", "delivered", "failed_delivery", "returned"]);

export interface RiskCalculationResult {
  customerId: string;
  cancellationRisk: number;
  deliveryRisk: number;
  returnRisk: number;
  overallRisk: number;
  cancellationCategory: RiskLevel;
  deliveryCategory: RiskLevel;
  returnCategory: RiskLevel;
  overallCategory: RiskLevel;
}

// Transparent, rule-based only (Part 3 explicitly forbids AI here). Every
// ratio is a plain percentage a human can recompute by hand from the numbers
// already visible on the customer's Orders tab — nothing hidden in a model.
export async function recalculateCustomerRisk(customerId: string): Promise<RiskCalculationResult> {
  const supabase = createAdminClient();

  const [{ data: customer, error: customerError }, { data: orders }, { data: config }, { data: previousProfile }] = await Promise.all([
    supabase
      .from("customers")
      .select("total_orders, cancelled_orders, delivered_orders, returned_orders")
      .eq("id", customerId)
      .single(),
    supabase.from("orders").select("status").eq("customer_id", customerId),
    supabase.from("risk_config").select("*"),
    supabase.from("customer_risk_profiles").select("overall_risk_category").eq("customer_id", customerId).maybeSingle(),
  ]);

  if (customerError || !customer) {
    throw new Error(`Customer not found: ${customerError?.message ?? customerId}`);
  }

  const orderRows = orders ?? [];
  const shippedCount = orderRows.filter((order) => SHIPPED_STATUSES.has(order.status)).length;
  const failedDeliveryCount = orderRows.filter((order) => order.status === "failed_delivery").length;

  const cancellationRisk = safeRatio(customer.cancelled_orders, customer.total_orders);
  const deliveryRisk = safeRatio(failedDeliveryCount, shippedCount);
  const returnRisk = safeRatio(customer.returned_orders, customer.delivered_orders);
  // Overall = simple average of the three, documented and reproducible —
  // not a weighted/black-box blend.
  const overallRisk = round2((cancellationRisk + deliveryRisk + returnRisk) / 3);

  const configRows = config ?? [];
  const cancellationCategory = resolveRiskCategory("cancellation", cancellationRisk, configRows);
  const deliveryCategory = resolveRiskCategory("delivery", deliveryRisk, configRows);
  const returnCategory = resolveRiskCategory("return", returnRisk, configRows);
  const overallCategory = resolveRiskCategory("overall", overallRisk, configRows);

  const { error: upsertError } = await supabase.from("customer_risk_profiles").upsert({
    customer_id: customerId,
    cancellation_risk: round2(cancellationRisk),
    delivery_risk: round2(deliveryRisk),
    return_risk: round2(returnRisk),
    overall_risk: overallRisk,
    cancellation_risk_category: cancellationCategory,
    delivery_risk_category: deliveryCategory,
    return_risk_category: returnCategory,
    overall_risk_category: overallCategory,
    computed_at: new Date().toISOString(),
  });

  if (upsertError) {
    throw new Error(`Failed to store risk profile: ${upsertError.message}`);
  }

  if (previousProfile?.overall_risk_category !== overallCategory) {
    await dispatchEvent("customer.risk_changed", { customerId });
  }

  return {
    customerId,
    cancellationRisk: round2(cancellationRisk),
    deliveryRisk: round2(deliveryRisk),
    returnRisk: round2(returnRisk),
    overallRisk,
    cancellationCategory,
    deliveryCategory,
    returnCategory,
    overallCategory,
  };
}

// No data yet (denominator 0) means "no evidence of risk", not NaN/Infinity —
// this is the Part 3 "zero-order customer" case: a customer with no orders
// at all gets 0% risk on every axis, never a crash.
function safeRatio(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function resolveRiskCategory(riskType: RiskType, value: number, config: { risk_type: string; category: RiskLevel; min_threshold: number }[]): RiskLevel {
  const relevant = [...config].filter((row) => row.risk_type === riskType).sort((a, b) => b.min_threshold - a.min_threshold);
  for (const row of relevant) {
    if (value >= row.min_threshold) return row.category;
  }
  return "low";
}
