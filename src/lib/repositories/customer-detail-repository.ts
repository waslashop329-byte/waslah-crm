import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  CallAttemptAnalysisRow,
  CustomerRow,
  CustomerPhoneRow,
  CustomerAddressRow,
  CustomerEventRow,
  CustomerNoteRow,
  FollowUpRow,
  OrderCallAttemptRow,
  OrderItemRow,
  OrderRow,
  TagRow,
} from "@/lib/types/database";

export interface CustomerDetail extends CustomerRow {
  phones: CustomerPhoneRow[];
  tags: TagRow[];
}

export async function getCustomerDetail(customerId: string): Promise<CustomerDetail | null> {
  const supabase = await createClient();

  const { data: customer } = await supabase.from("customers").select("*").eq("id", customerId).is("deleted_at", null).maybeSingle();
  if (!customer) return null;

  const [{ data: phones }, { data: tagRows }] = await Promise.all([
    supabase.from("customer_phones").select("*").eq("customer_id", customerId).order("is_primary", { ascending: false }),
    supabase
      .from("customer_tags")
      .select("tags(*)")
      .eq("customer_id", customerId)
      .is("removed_at", null),
  ]);

  const tags = (tagRows ?? [])
    .map((row) => row.tags as unknown as TagRow | null)
    .filter((tag): tag is TagRow => tag !== null);

  return { ...customer, phones: phones ?? [], tags };
}

export interface TimelineEventWithEmployee extends CustomerEventRow {
  employeeName: string | null;
}

export async function getCustomerTimeline(customerId: string, limit = 50): Promise<TimelineEventWithEmployee[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_events")
    .select("*, profiles(full_name)")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((event) => {
    const { profiles, ...rest } = event as CustomerEventRow & { profiles: { full_name: string } | null };
    return { ...rest, employeeName: profiles?.full_name ?? null };
  });
}

export interface NoteWithAuthor extends CustomerNoteRow {
  authorName: string;
}

export async function getCustomerNotes(customerId: string): Promise<NoteWithAuthor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_notes")
    .select("*, profiles(full_name)")
    .eq("customer_id", customerId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((note) => {
    const { profiles, ...rest } = note as CustomerNoteRow & { profiles: { full_name: string } | null };
    return { ...rest, authorName: profiles?.full_name ?? "Unknown" };
  });
}

export async function getCustomerFollowUps(customerId: string): Promise<FollowUpRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follow_ups")
    .select("*")
    .eq("customer_id", customerId)
    .order("due_date", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export interface OrderWithItems extends OrderRow {
  order_items: OrderItemRow[];
  order_call_attempts: (OrderCallAttemptRow & { call_attempt_analysis: CallAttemptAnalysisRow | null })[];
}

export async function getCustomerOrders(customerId: string): Promise<OrderWithItems[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), order_call_attempts(*, call_attempt_analysis(*))")
    .eq("customer_id", customerId)
    .order("ordered_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as OrderWithItems[];
}

export async function getCustomerAddresses(customerId: string): Promise<CustomerAddressRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customer_addresses")
    .select("*")
    .eq("customer_id", customerId)
    .order("is_primary", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
