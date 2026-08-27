import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Workflow, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listCampaigns } from "@/lib/repositories/campaign-repository";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CampaignFormDialog } from "@/components/campaigns/campaign-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("campaigns");

  if (!user.can("campaigns.view")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const campaigns = await listCampaigns();
  const canManage = user.can("campaigns.manage");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage ? <CampaignFormDialog /> : null}
      </div>

      {campaigns.length === 0 ? (
        <EmptyState icon={Workflow} title={t("noCampaignsTitle")} description={t("noCampaignsDescription")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
