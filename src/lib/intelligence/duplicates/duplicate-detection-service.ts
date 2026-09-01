import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/services/notification-service";
import { fetchAllRows } from "@/lib/supabase/fetch-all-rows";

// Transparent, explainable confidence — every point is traceable to a named
// signal (Part 4 explicitly forbids an unexplained black-box score).
const SIGNAL_WEIGHTS = {
  same_phone: 45,
  same_email: 45,
  similar_name_high: 25,
  similar_name_medium: 15,
  similar_address: 15,
  similar_phone: 10,
} as const;

const MIN_CONFIDENCE_TO_RECORD = 30;
const NAME_SIMILARITY_THRESHOLD = 0.35;
const HIGH_NAME_SIMILARITY = 0.6;

export interface DuplicateScanResult {
  pairsEvaluated: number;
  candidatesRecorded: number;
}

// Scans the whole active customer base for possible duplicates. Exact-match
// signals (phone, email) are grouped in a single pass (O(n), not O(n^2));
// fuzzy name matching is delegated to a Postgres function that uses the
// pg_trgm index (find_similar_customer_names) instead of comparing every
// customer to every other customer in application code.
export async function scanForDuplicateCandidates(): Promise<DuplicateScanResult> {
  const supabase = createAdminClient();

  // Both page past PostgREST's 1000-row cap — the whole active customer base
  // has to be scanned for this to actually find every real duplicate.
  const [customers, phoneRows, { data: nameMatches, error: nameError }] = await Promise.all([
    fetchAllRows((from, to) => supabase.from("customers").select("id, full_name, email").is("deleted_at", null).range(from, to)),
    fetchAllRows((from, to) => supabase.from("customer_phones").select("customer_id, phone_normalized").range(from, to)),
    supabase.rpc("find_similar_customer_names", { similarity_threshold: NAME_SIMILARITY_THRESHOLD }),
  ]);

  if (nameError) {
    throw new Error(`Name similarity scan failed: ${nameError.message}`);
  }

  const customerById = new Map(customers.map((c) => [c.id, c]));

  const phonesByCustomer = new Map<string, Set<string>>();
  for (const row of phoneRows) {
    if (!row.phone_normalized) continue;
    const set = phonesByCustomer.get(row.customer_id) ?? new Set<string>();
    set.add(row.phone_normalized);
    phonesByCustomer.set(row.customer_id, set);
  }

  const phoneGroups = new Map<string, string[]>();
  for (const [customerId, phones] of phonesByCustomer) {
    for (const phone of phones) {
      const list = phoneGroups.get(phone) ?? [];
      list.push(customerId);
      phoneGroups.set(phone, list);
    }
  }

  const emailGroups = new Map<string, string[]>();
  for (const customer of customers) {
    if (!customer.email) continue;
    const key = customer.email.toLowerCase().trim();
    const list = emailGroups.get(key) ?? [];
    list.push(customer.id);
    emailGroups.set(key, list);
  }

  const pairKeys = new Set<string>();
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  const addGroupPairs = (list: string[]) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) pairKeys.add(pairKey(list[i], list[j]));
    }
  };

  for (const list of phoneGroups.values()) if (list.length > 1) addGroupPairs(list);
  for (const list of emailGroups.values()) if (list.length > 1) addGroupPairs(list);
  for (const row of nameMatches ?? []) pairKeys.add(pairKey(row.customer_id_a, row.customer_id_b));

  let candidatesRecorded = 0;

  for (const key of pairKeys) {
    const [idA, idB] = key.split("|");
    const customerA = customerById.get(idA);
    const customerB = customerById.get(idB);
    if (!customerA || !customerB) continue;

    const signals: string[] = [];
    let confidence = 0;

    const phonesA = phonesByCustomer.get(idA) ?? new Set<string>();
    const phonesB = phonesByCustomer.get(idB) ?? new Set<string>();
    const samePhone = [...phonesA].some((phone) => phonesB.has(phone));

    if (samePhone) {
      signals.push("Same normalized phone");
      confidence += SIGNAL_WEIGHTS.same_phone;
    } else if (hasSimilarPhone(phonesA, phonesB)) {
      signals.push("Similar phone number");
      confidence += SIGNAL_WEIGHTS.similar_phone;
    }

    if (customerA.email && customerB.email && customerA.email.toLowerCase().trim() === customerB.email.toLowerCase().trim()) {
      signals.push("Same email");
      confidence += SIGNAL_WEIGHTS.same_email;
    }

    const nameMatch = (nameMatches ?? []).find(
      (row) =>
        (row.customer_id_a === idA && row.customer_id_b === idB) || (row.customer_id_a === idB && row.customer_id_b === idA),
    );
    if (nameMatch) {
      const percent = Math.round(nameMatch.name_similarity * 100);
      signals.push(`Similar name (${percent}% match)`);
      confidence += nameMatch.name_similarity >= HIGH_NAME_SIMILARITY ? SIGNAL_WEIGHTS.similar_name_high : SIGNAL_WEIGHTS.similar_name_medium;
    }

    confidence = Math.min(100, confidence);
    if (confidence < MIN_CONFIDENCE_TO_RECORD) continue;

    await upsertCandidate(idA, idB, confidence, signals);
    candidatesRecorded++;
  }

  return { pairsEvaluated: pairKeys.size, candidatesRecorded };
}

// Same last-8-digits heuristic catches typo'd country codes / leading digits
// that survive normalization as genuinely different numbers.
function hasSimilarPhone(phonesA: Set<string>, phonesB: Set<string>): boolean {
  for (const a of phonesA) {
    for (const b of phonesB) {
      if (a !== b && a.length >= 8 && b.length >= 8 && a.slice(-8) === b.slice(-8)) return true;
    }
  }
  return false;
}

async function upsertCandidate(customerIdA: string, customerIdB: string, confidence: number, signals: string[]): Promise<void> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("duplicate_candidates")
    .select("id, status")
    .or(`and(customer_id_a.eq.${customerIdA},customer_id_b.eq.${customerIdB}),and(customer_id_a.eq.${customerIdB},customer_id_b.eq.${customerIdA})`)
    .maybeSingle();

  if (existing) {
    // Only refresh pending candidates — an already-ignored or merged pair's
    // record is a historical decision, not something a re-scan should undo.
    if (existing.status === "pending") {
      await supabase.from("duplicate_candidates").update({ confidence_score: confidence, signals }).eq("id", existing.id);
    }
    return;
  }

  await supabase.from("duplicate_candidates").insert({
    customer_id_a: customerIdA,
    customer_id_b: customerIdB,
    confidence_score: confidence,
    signals,
    status: "pending",
    resolved_at: null,
    resolved_by: null,
  });

  // "Duplicate candidate created" (Part 17) — only for genuinely new pairs,
  // not on every re-scan refresh above. Notify whichever customer has an
  // assignee; if neither does, nobody's watching this pair yet, which is fine.
  const { data: customers } = await supabase.from("customers").select("id, full_name, assigned_to").in("id", [customerIdA, customerIdB]);
  const notifyTarget = (customers ?? []).find((c) => c.assigned_to);
  if (notifyTarget?.assigned_to) {
    const other = (customers ?? []).find((c) => c.id !== notifyTarget.id);
    await createNotification({
      recipientId: notifyTarget.assigned_to,
      type: "duplicate_candidate",
      title: "Possible duplicate customer",
      message: `${notifyTarget.full_name} may be a duplicate of ${other?.full_name ?? "another customer"} (${Math.round(confidence)}% confidence).`,
      relatedEntityType: "customer",
      relatedEntityId: notifyTarget.id,
    });
  }
}
