import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

export type CustomerMatchResult =
  | { kind: "matched"; customerId: string; matchedBy: "external_id" | "phone" | "email" }
  | { kind: "ambiguous"; candidateIds: string[]; matchedBy: "phone" | "email" }
  | { kind: "no_match" };

export interface CustomerMatchInput {
  source: string;
  externalId: string;
  normalizedPhone: string | null;
  email: string | null;
}

// Matching priority (Part 4): external id is the strongest signal (we've
// already confirmed this exact record before), then exact normalized phone,
// then email. A single candidate at any tier is a match; more than one is
// ambiguous and must not be auto-merged — the caller records a
// duplicate_candidate and picks a working match instead of blocking.
export async function matchCustomer(input: CustomerMatchInput): Promise<CustomerMatchResult> {
  const supabase = createAdminClient();

  const { data: externalMatch } = await supabase
    .from("customer_external_ids")
    .select("customer_id")
    .eq("source", input.source)
    .eq("external_id", input.externalId)
    .maybeSingle();

  if (externalMatch) {
    return { kind: "matched", customerId: externalMatch.customer_id, matchedBy: "external_id" };
  }

  if (input.normalizedPhone) {
    const { data: phoneMatches } = await supabase
      .from("customer_phones")
      .select("customer_id")
      .eq("phone_normalized", input.normalizedPhone);

    const candidateIds = Array.from(new Set((phoneMatches ?? []).map((row) => row.customer_id)));
    if (candidateIds.length === 1) return { kind: "matched", customerId: candidateIds[0], matchedBy: "phone" };
    if (candidateIds.length > 1) return { kind: "ambiguous", candidateIds, matchedBy: "phone" };
  }

  if (input.email) {
    const { data: emailMatches } = await supabase.from("customers").select("id").eq("email", input.email).is("deleted_at", null);

    const candidateIds = (emailMatches ?? []).map((row) => row.id);
    if (candidateIds.length === 1) return { kind: "matched", customerId: candidateIds[0], matchedBy: "email" };
    if (candidateIds.length > 1) return { kind: "ambiguous", candidateIds, matchedBy: "email" };
  }

  return { kind: "no_match" };
}

export async function recordExternalId(customerId: string, source: string, externalId: string, metadata: Json = {}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("customer_external_ids")
    .upsert({ customer_id: customerId, source, external_id: externalId, metadata }, { onConflict: "source,external_id" });

  if (error) {
    throw new Error(`Failed to record external id: ${error.message}`);
  }
}

export async function recordDuplicateCandidates(customerIdA: string, otherCandidateIds: string[], confidenceScore: number, signals: string[]): Promise<void> {
  const supabase = createAdminClient();

  const rows = otherCandidateIds
    .filter((id) => id !== customerIdA)
    .map((customerIdB) => ({
      customer_id_a: customerIdA,
      customer_id_b: customerIdB,
      confidence_score: confidenceScore,
      signals,
      status: "pending" as const,
      resolved_at: null,
      resolved_by: null,
    }));

  if (rows.length === 0) return;

  // The (least, greatest) unique index means a duplicate insert 409s — that's
  // fine, it means this pair was already flagged.
  const { error } = await supabase.from("duplicate_candidates").insert(rows);
  if (error && !error.message.includes("duplicate key")) {
    throw new Error(`Failed to record duplicate candidates: ${error.message}`);
  }
}
