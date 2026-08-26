import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SEGMENT_FIELDS, type SegmentConditions, type SegmentCondition } from "@/lib/intelligence/segments/segment-schema";
import type { SegmentCustomerViewRow } from "@/lib/types/database";

interface ResolvedCondition {
  column: keyof SegmentCustomerViewRow;
  pgOperator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "cs";
  value: string | number;
}

const NUMERIC_OPERATOR_MAP: Record<string, ResolvedCondition["pgOperator"]> = {
  equals: "eq",
  not_equals: "neq",
  greater_than: "gt",
  greater_than_or_equal: "gte",
  less_than: "lt",
  less_than_or_equal: "lte",
};

// `field` is already constrained to a SEGMENT_FIELDS key by Zod before this
// runs, so the column name written into the query is always one of our own
// whitelisted strings — never anything derived from free-text user input.
function resolveCondition(condition: SegmentCondition): ResolvedCondition {
  const fieldDef = SEGMENT_FIELDS[condition.field];

  if (fieldDef.type === "tag") {
    return { column: "tag_names", pgOperator: "cs", value: String(condition.value) };
  }

  if (condition.operator === "days_since_greater_than" || condition.operator === "days_since_less_than") {
    const cutoff = new Date(Date.now() - Number(condition.value) * 24 * 60 * 60 * 1000).toISOString();
    return {
      column: fieldDef.column as keyof SegmentCustomerViewRow,
      pgOperator: condition.operator === "days_since_greater_than" ? "lt" : "gt",
      value: cutoff,
    };
  }

  const pgOperator = NUMERIC_OPERATOR_MAP[condition.operator];
  if (!pgOperator) {
    throw new Error(`Unsupported operator "${condition.operator}" for field "${condition.field}"`);
  }

  return { column: fieldDef.column as keyof SegmentCustomerViewRow, pgOperator, value: condition.value };
}

// PostgREST's .or() takes a filter *string*, not SQL — but a string value
// still needs quoting/escaping so a comma or parenthesis inside it can't
// break out of its condition. Numbers never need this.
function formatOrValue(value: string | number): string {
  if (typeof value === "number") return String(value);
  return `"${value.replace(/"/g, '\\"')}"`;
}

function resolveAll(conditions: SegmentConditions) {
  return conditions.conditions.map(resolveCondition);
}

function buildOrFilter(resolved: ResolvedCondition[]): string {
  return resolved
    .map((condition) => {
      const value = condition.pgOperator === "cs" ? `{${condition.value}}` : formatOrValue(condition.value);
      return `${condition.column}.${condition.pgOperator}.${value}`;
    })
    .join(",");
}

export async function evaluateSegmentConditions(conditions: SegmentConditions, limit?: number): Promise<SegmentCustomerViewRow[]> {
  const supabase = await createClient();
  const resolved = resolveAll(conditions);

  let query = supabase.from("segment_customer_view").select("*").is("deleted_at", null);

  if (conditions.operator === "AND") {
    for (const condition of resolved) {
      switch (condition.pgOperator) {
        case "eq":
          query = query.eq(condition.column, condition.value);
          break;
        case "neq":
          query = query.neq(condition.column, condition.value);
          break;
        case "gt":
          query = query.gt(condition.column, condition.value);
          break;
        case "gte":
          query = query.gte(condition.column, condition.value);
          break;
        case "lt":
          query = query.lt(condition.column, condition.value);
          break;
        case "lte":
          query = query.lte(condition.column, condition.value);
          break;
        case "cs":
          query = query.contains(condition.column, [condition.value]);
          break;
      }
    }
  } else {
    query = query.or(buildOrFilter(resolved));
  }

  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function countSegmentMembers(conditions: SegmentConditions): Promise<number> {
  const supabase = await createClient();
  const resolved = resolveAll(conditions);

  let query = supabase.from("segment_customer_view").select("*", { count: "exact", head: true }).is("deleted_at", null);

  if (conditions.operator === "AND") {
    for (const condition of resolved) {
      switch (condition.pgOperator) {
        case "eq":
          query = query.eq(condition.column, condition.value);
          break;
        case "neq":
          query = query.neq(condition.column, condition.value);
          break;
        case "gt":
          query = query.gt(condition.column, condition.value);
          break;
        case "gte":
          query = query.gte(condition.column, condition.value);
          break;
        case "lt":
          query = query.lt(condition.column, condition.value);
          break;
        case "lte":
          query = query.lte(condition.column, condition.value);
          break;
        case "cs":
          query = query.contains(condition.column, [condition.value]);
          break;
      }
    }
  } else {
    query = query.or(buildOrFilter(resolved));
  }

  const { count, error } = await query;
  if (error) throw new Error(error.message);
  return count ?? 0;
}
