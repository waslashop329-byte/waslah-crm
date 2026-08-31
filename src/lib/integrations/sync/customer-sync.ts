import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchCustomer, recordExternalId, recordDuplicateCandidates } from "@/lib/integrations/matching/customer-matcher";
import { recordCustomerEvent } from "@/lib/services/timeline-service";
import { dispatchEvent } from "@/lib/events/dispatcher";
import type { NormalizedCustomer } from "@/lib/integrations/types/normalized";

export interface CustomerSyncResult {
  customerId: string;
  created: boolean;
  ambiguous: boolean;
}

export async function syncCustomer(customer: NormalizedCustomer): Promise<CustomerSyncResult> {
  const supabase = createAdminClient();
  const primaryPhone = customer.phones[0];

  const match = await matchCustomer({
    source: customer.source,
    externalId: customer.externalId,
    normalizedPhone: primaryPhone?.normalized ?? null,
    email: customer.email ?? null,
  });

  if (match.kind === "matched") {
    await recordExternalId(match.customerId, customer.source, customer.externalId);
    await syncCustomerPhones(match.customerId, customer);
    await syncCustomerAddresses(match.customerId, customer);
    await dispatchEvent("customer.updated", { customerId: match.customerId });
    return { customerId: match.customerId, created: false, ambiguous: false };
  }

  if (match.kind === "ambiguous") {
    // Never auto-merge: work against the first candidate so the data still
    // gets recorded, but flag the rest of the pair(s) for human review.
    const workingId = match.candidateIds[0];
    await recordExternalId(workingId, customer.source, customer.externalId);
    await recordDuplicateCandidates(workingId, match.candidateIds.slice(1), 60, [`shared_${match.matchedBy}`]);
    await dispatchEvent("customer.updated", { customerId: workingId });
    return { customerId: workingId, created: false, ambiguous: true };
  }

  const { data: newCustomer, error } = await supabase
    .from("customers")
    .insert({
      full_name: customer.fullName,
      email: customer.email ?? null,
      status: "active",
      source: customer.source,
    })
    .select("id")
    .single();

  if (error || !newCustomer) {
    throw new Error(`Failed to create customer: ${error?.message ?? "unknown error"}`);
  }

  await recordExternalId(newCustomer.id, customer.source, customer.externalId);
  await syncCustomerPhones(newCustomer.id, customer);
  await syncCustomerAddresses(newCustomer.id, customer);

  await recordCustomerEvent({
    customerId: newCustomer.id,
    eventType: "customer.created",
    title: "Customer created",
    description: `Synced from ${customer.source}`,
  });

  await dispatchEvent("customer.created", { customerId: newCustomer.id });

  return { customerId: newCustomer.id, created: true, ambiguous: false };
}

// customer.addresses was defined on NormalizedCustomer from the start but
// never actually persisted anywhere — found while wiring up the Excel
// importer (Part 22). Same dedupe-by-content approach as
// syncCustomerPhones(): re-syncing the same source data twice never creates
// duplicate rows.
async function syncCustomerAddresses(customerId: string, customer: NormalizedCustomer): Promise<void> {
  const supabase = createAdminClient();

  for (const address of customer.addresses ?? []) {
    const { data: existing } = await supabase
      .from("customer_addresses")
      .select("id")
      .eq("customer_id", customerId)
      .eq("address_line", address.addressLine)
      .maybeSingle();

    if (existing) continue;

    await supabase.from("customer_addresses").insert({
      customer_id: customerId,
      label: null,
      address_line: address.addressLine,
      city: address.city ?? null,
      governorate: address.governorate ?? null,
      area: address.area ?? null,
      details: address.details ?? null,
      country: "EG",
      is_primary: address.isPrimary ?? false,
    });
  }
}

async function syncCustomerPhones(customerId: string, customer: NormalizedCustomer): Promise<void> {
  const supabase = createAdminClient();

  for (const [index, phone] of customer.phones.entries()) {
    const { data: existing } = await supabase
      .from("customer_phones")
      .select("id")
      .eq("customer_id", customerId)
      .eq("phone", phone.raw)
      .maybeSingle();

    if (existing) continue;

    await supabase.from("customer_phones").insert({
      customer_id: customerId,
      phone: phone.raw,
      phone_normalized: phone.normalized,
      is_primary: index === 0,
    });
  }
}
