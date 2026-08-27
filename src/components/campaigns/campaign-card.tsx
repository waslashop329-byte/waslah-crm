import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CampaignActiveToggle } from "@/components/campaigns/campaign-active-toggle";
import { DeleteCampaignButton } from "@/components/campaigns/delete-campaign-button";
import type { CampaignWithSteps } from "@/lib/repositories/campaign-repository";

export async function CampaignCard({ campaign, canManage }: { campaign: CampaignWithSteps; canManage: boolean }) {
  const t = await getTranslations("campaigns");
  const totalEnrolled = campaign.enrollmentStats.active + campaign.enrollmentStats.completed + campaign.enrollmentStats.exited;

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            {campaign.name}
            <Badge variant="secondary" className="text-[10px]">
              {campaign.trigger_type === "order_delivered" ? t("triggerOrderDelivered") : t("triggerCustomerInactive")}
            </Badge>
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("stepsCount", { count: campaign.steps.length })}</p>
        </div>
        {canManage ? (
          <div className="flex shrink-0 items-center gap-2">
            <CampaignActiveToggle campaignId={campaign.id} initialActive={campaign.is_active} />
            {totalEnrolled === 0 ? <DeleteCampaignButton campaignId={campaign.id} campaignName={campaign.name} /> : null}
          </div>
        ) : null}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <p className="text-lg font-semibold tabular-nums">{campaign.enrollmentStats.active.toLocaleString("en-US")}</p>
            <p className="text-xs text-muted-foreground">{t("stats.active")}</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">{campaign.enrollmentStats.completed.toLocaleString("en-US")}</p>
            <p className="text-xs text-muted-foreground">{t("stats.completed")}</p>
          </div>
          <div>
            <p className="text-lg font-semibold tabular-nums">{campaign.enrollmentStats.exited.toLocaleString("en-US")}</p>
            <p className="text-xs text-muted-foreground">{t("stats.exited")}</p>
          </div>
        </div>
        {!campaign.is_active ? <p className="mt-3 text-xs text-muted-foreground">{t("inactiveNote")}</p> : null}
      </CardContent>
    </Card>
  );
}
