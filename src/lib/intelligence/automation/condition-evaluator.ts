import "server-only";
import { SEGMENT_FIELDS, type SegmentConditions, type SegmentCondition } from "@/lib/intelligence/segments/segment-schema";
import type { SegmentCustomerViewRow } from "@/lib/types/database";

// Reuses the exact same field/operator whitelist the segment builder uses
// (Part 10: "Use the same safe rule evaluation architecture where
// possible") — but evaluates in memory against one already-fetched customer
// row instead of building a query, since automation conditions only ever
// need to answer "does this one customer match right now?".
function evaluateSingle(condition: SegmentCondition, row: SegmentCustomerViewRow): boolean {
  const fieldDef = SEGMENT_FIELDS[condition.field];
  const rawValue = row[fieldDef.column as keyof SegmentCustomerViewRow];

  if (fieldDef.type === "tag") {
    return Array.isArray(rawValue) && rawValue.includes(String(condition.value));
  }

  if (condition.operator === "days_since_greater_than" || condition.operator === "days_since_less_than") {
    if (!rawValue) return false;
    const daysSince = (Date.now() - new Date(String(rawValue)).getTime()) / (1000 * 60 * 60 * 24);
    return condition.operator === "days_since_greater_than" ? daysSince > Number(condition.value) : daysSince < Number(condition.value);
  }

  switch (condition.operator) {
    case "equals":
      return String(rawValue) === String(condition.value);
    case "not_equals":
      return String(rawValue) !== String(condition.value);
    case "greater_than":
      return Number(rawValue) > Number(condition.value);
    case "greater_than_or_equal":
      return Number(rawValue) >= Number(condition.value);
    case "less_than":
      return Number(rawValue) < Number(condition.value);
    case "less_than_or_equal":
      return Number(rawValue) <= Number(condition.value);
    default:
      return false;
  }
}

// No conditions configured = always matches (a trigger-only rule, e.g.
// "on every order.delivered, do X" with no extra filter).
export function evaluateConditions(conditions: SegmentConditions | null, row: SegmentCustomerViewRow): boolean {
  if (!conditions || conditions.conditions.length === 0) return true;
  const results = conditions.conditions.map((condition) => evaluateSingle(condition, row));
  return conditions.operator === "AND" ? results.every(Boolean) : results.some(Boolean);
}
