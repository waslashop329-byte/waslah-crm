import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";
import type { ComplaintRow, ComplaintStatus } from "@/lib/types/database";

export interface ComplaintWithCustomer extends ComplaintRow {
  customer_full_name: string;
}

export async function listComplaints(status?: ComplaintStatus): Promise<ComplaintWithCustomer[]> {
  const supabase = await createClient();

  // Paged past PostgREST's 1000-row cap — the whole point of a "no
  // pagination UI, show everything" list page is that it actually needs to
  // show everything.
  const data = await fetchAllRows((from, to) => {
    let query = supabase.from("complaints").select("*, customers(full_name)").order("created_at", { ascending: false }).range(from, to);
    if (status) query = query.eq("status", status);
    return query;
  });

  return data.map((row) => {
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
