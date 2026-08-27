import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CampaignRow, CampaignStepRow, CampaignTriggerType } from "@/lib/types/database";

export interface CampaignEnrollmentStats {
  active: number;
  completed: number;
  exited: number;
}

export interface CampaignWithSteps extends CampaignRow {
  steps: CampaignStepRow[];
  enrollmentStats: CampaignEnrollmentStats;
}

export async function listCampaigns(): Promise<CampaignWithSteps[]> {
  const supabase = await createClient();

  const { data: campaigns, error } = await supabase.from("campaigns").select("*, campaign_steps(*)").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  if (!campaigns || campaigns.length === 0) return [];

  const { data: enrollments } = await supabase
    .from("campaign_enrollments")
    .select("campaign_id, status")
    .in(
      "campaign_id",
      campaigns.map((c) => c.id),
    );

  const statsByCampaign = new Map<string, CampaignEnrollmentStats>();
  for (const enrollment of enrollments ?? []) {
    const stats = statsByCampaign.get(enrollment.campaign_id) ?? { active: 0, completed: 0, exited: 0 };
    stats[enrollment.status as keyof CampaignEnrollmentStats] += 1;
    statsByCampaign.set(enrollment.campaign_id, stats);
  }

  return campaigns.map((campaign) => {
    const { campaign_steps, ...row } = campaign as CampaignRow & { campaign_steps: CampaignStepRow[] };
    return {
      ...row,
      steps: (campaign_steps ?? []).sort((a, b) => a.step_order - b.step_order),
      enrollmentStats: statsByCampaign.get(row.id) ?? { active: 0, completed: 0, exited: 0 },
    };
  });
}

export interface CampaignStepInput {
  delayDays: number;
  channel: "whatsapp" | "sms";
  messageTemplate: string;
}

export interface CampaignFormInput {
  name: string;
  triggerType: CampaignTriggerType;
  steps: CampaignStepInput[];
}
