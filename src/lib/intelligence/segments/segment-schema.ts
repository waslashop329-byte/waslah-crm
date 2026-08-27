import { z } from "zod";

// Part 8 explicitly forbids raw SQL built from user input. This whitelist is
// the safety boundary: a condition's `field` must be one of these keys before
// it's ever turned into a query — anything else is rejected by Zod before it
// reaches the evaluator. Only `column`/`type` here are trusted; the actual
// comparison value always travels through the query builder's own
// parameterization (or, for OR-chains, through explicit escaping) — it is
// never string-concatenated into SQL.
export const SEGMENT_FIELDS = {
  total_orders: { column: "total_orders", type: "number", label: "Total Orders" },
  delivered_orders: { column: "delivered_orders", type: "number", label: "Delivered Orders" },
  cancelled_orders: { column: "cancelled_orders", type: "number", label: "Cancelled Orders" },
  returned_orders: { column: "returned_orders", type: "number", label: "Returned Orders" },
  total_spend: { column: "total_spend", type: "number", label: "Total Spend" },
  avg_order_value: { column: "avg_order_value", type: "number", label: "Avg Order Value" },
  customer_score: { column: "score", type: "number", label: "Customer Score" },
  status: { column: "status", type: "string", label: "Status" },
  last_order_at: { column: "last_order_at", type: "date", label: "Last Order Date" },
  customer_since: { column: "customer_since", type: "date", label: "Customer Since" },
  tag: { column: "tag_names", type: "tag", label: "Tag" },
  location: { column: "governorates", type: "tag", label: "Location (governorate)" },
  purchased_category: { column: "purchased_categories", type: "tag", label: "Purchased Category" },
  purchased_product: { column: "purchased_products", type: "tag", label: "Purchased Product" },
  cancellation_risk_category: { column: "cancellation_risk_category", type: "string", label: "Cancellation Risk" },
  delivery_risk_category: { column: "delivery_risk_category", type: "string", label: "Delivery Risk" },
  return_risk_category: { column: "return_risk_category", type: "string", label: "Return Risk" },
  overall_risk_category: { column: "overall_risk_category", type: "string", label: "Overall Risk" },
} as const;

export type SegmentFieldKey = keyof typeof SEGMENT_FIELDS;

export const SEGMENT_OPERATORS = [
  "equals",
  "not_equals",
  "greater_than",
  "greater_than_or_equal",
  "less_than",
  "less_than_or_equal",
  "contains",
  "days_since_greater_than",
  "days_since_less_than",
] as const;

export type SegmentOperator = (typeof SEGMENT_OPERATORS)[number];

export const segmentConditionSchema = z.object({
  field: z.enum(Object.keys(SEGMENT_FIELDS) as [SegmentFieldKey, ...SegmentFieldKey[]]),
  operator: z.enum(SEGMENT_OPERATORS),
  value: z.union([z.string(), z.number()]),
});

export const segmentConditionsSchema = z.object({
  operator: z.enum(["AND", "OR"]),
  conditions: z.array(segmentConditionSchema).min(1, "At least one condition is required").max(10, "Too many conditions"),
});

export type SegmentCondition = z.infer<typeof segmentConditionSchema>;
export type SegmentConditions = z.infer<typeof segmentConditionsSchema>;

// Server-side validation, used before ever passing a rule set to the evaluator.
export function validateSegmentConditions(input: unknown): { success: true; data: SegmentConditions } | { success: false; error: string } {
  const parsed = segmentConditionsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join("; ") };

  for (const condition of parsed.data.conditions) {
    const fieldDef = SEGMENT_FIELDS[condition.field];
    if (fieldDef.type === "tag" && condition.operator !== "contains") {
      return { success: false, error: "The tag field only supports the 'contains' operator" };
    }
    if ((condition.operator === "days_since_greater_than" || condition.operator === "days_since_less_than") && fieldDef.type !== "date") {
      return { success: false, error: `${condition.operator} can only be used on date fields` };
    }
  }

  return { success: true, data: parsed.data };
}
