import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { ImportWorkspace } from "@/components/data-import/import-workspace";
import { EmptyState } from "@/components/shared/empty-state";

export default async function DataImportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("dataImport");

  if (!user.can("integrations.manage")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <ImportWorkspace />
    </div>
  );
}
