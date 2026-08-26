import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CustomerRiskProfileRow, RiskConfigRow } from "@/lib/types/database";

export async function getCustomerRiskProfile(customerId: string): Promise<CustomerRiskProfileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("customer_risk_profiles").select("*").eq("customer_id", customerId).maybeSingle();
  return data ?? null;
}

export async function getRiskConfig(): Promise<RiskConfigRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("risk_config").select("*").order("risk_type").order("min_threshold");
  if (error) throw new Error(error.message);
  return data ?? [];
}
