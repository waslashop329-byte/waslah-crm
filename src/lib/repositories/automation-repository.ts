import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AutomationRuleRow, AutomationExecutionRow } from "@/lib/types/database";

export interface AutomationRuleWithStats extends AutomationRuleRow {
  executionCount: number;
  lastExecutionAt: string | null;
  successRate: number | null;
}

export async function listAutomationRules(): Promise<AutomationRuleWithStats[]> {
  const supabase = await createClient();

  const { data: rules, error } = await supabase.from("automation_rules").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!rules || rules.length === 0) return [];

  const { data: executions } = await supabase
    .from("automation_executions")
    .select("automation_rule_id, status, started_at")
    .in(
      "automation_rule_id",
      rules.map((r) => r.id),
    );

  const statsByRule = new Map<string, { count: number; completed: number; lastAt: string | null }>();
  for (const execution of executions ?? []) {
    if (!execution.automation_rule_id) continue; // rule was since deleted; excluded from list stats, still visible on its own detail page while it existed
    const entry = statsByRule.get(execution.automation_rule_id) ?? { count: 0, completed: 0, lastAt: null };
    entry.count++;
    if (execution.status === "completed") entry.completed++;
    if (!entry.lastAt || execution.started_at > entry.lastAt) entry.lastAt = execution.started_at;
    statsByRule.set(execution.automation_rule_id, entry);
  }

  return rules.map((rule) => {
    const stats = statsByRule.get(rule.id);
    return {
      ...rule,
      executionCount: stats?.count ?? 0,
      lastExecutionAt: stats?.lastAt ?? null,
      successRate: stats && stats.count > 0 ? Math.round((stats.completed / stats.count) * 100) : null,
    };
  });
}

export async function getAutomationRule(ruleId: string): Promise<AutomationRuleRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("automation_rules").select("*").eq("id", ruleId).maybeSingle();
  return data ?? null;
}

export interface ExecutionListResult {
  executions: AutomationExecutionRow[];
  total: number;
}

export async function listAutomationExecutions(ruleId: string, limit = 50): Promise<ExecutionListResult> {
  const supabase = await createClient();

  const { data, count, error } = await supabase
    .from("automation_executions")
    .select("*", { count: "exact" })
    .eq("automation_rule_id", ruleId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return { executions: data ?? [], total: count ?? 0 };
}
