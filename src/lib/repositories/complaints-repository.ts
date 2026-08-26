import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ComplaintRow, ComplaintStatus } from "@/lib/types/database";

export interface ComplaintWithCustomer extends ComplaintRow {
  customer_full_name: string;
}

export async function listComplaints(status?: ComplaintStatus): Promise<ComplaintWithCustomer[]> {
  const supabase = await createClient();
  let query = supabase.from("complaints").select("*, customers(full_name)").order("created_at", { ascending: false });
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const { customers, ...complaint } = row as ComplaintRow & { customers: { full_name: string } | null };
    return { ...complaint, customer_full_name: customers?.full_name ?? "Unknown customer" };
  });
}

export async function getCustomerComplaints(customerId: string): Promise<ComplaintRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("complaints").select("*").eq("customer_id", customerId).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
