import "server-only";
import { createClient } from "@/lib/supabase/server";
import { recordAudit } from "@/lib/services/audit-service";
import type { CustomerAcquisitionRow } from "@/lib/types/database";

interface AcquisitionInput {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
  landingPage: string | null;
}

export async function setCustomerAcquisition(actorId: string, customerId: string, input: AcquisitionInput): Promise<CustomerAcquisitionRow> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("customer_acquisition")
    .upsert({
      customer_id: customerId,
      source: input.source,
      medium: input.medium,
      campaign: input.campaign,
      content: input.content,
      landing_page: input.landingPage,
    })
    .select()
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save acquisition info");

  await recordAudit({
    actorId,
    action: "customer.acquisition_updated",
    entityType: "customer",
    entityId: customerId,
    afterData: { source: input.source, medium: input.medium, campaign: input.campaign },
  });

  return data;
}

export async function getCustomerAcquisition(customerId: string): Promise<CustomerAcquisitionRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("customer_acquisition").select("*").eq("customer_id", customerId).maybeSingle();
  return data ?? null;
}
