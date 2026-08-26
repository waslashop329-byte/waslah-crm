import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert, Plug } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listIntegrations } from "@/lib/repositories/integration-repository";
import { IntegrationCard } from "@/components/integrations/integration-card";
import { EmptyState } from "@/components/shared/empty-state";

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("integrations");

  if (!user.can("integrations.manage")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        </div>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const integrations = await listIntegrations();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {integrations.length === 0 ? (
        <EmptyState icon={Plug} title={t("noIntegrationsTitle")} description={t("noIntegrationsDescription")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {integrations.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </div>
      )}
    </div>
  );
}
