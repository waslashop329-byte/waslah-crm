import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert, UserX } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getWinbackCandidates } from "@/lib/repositories/winback-repository";
import { WinbackTable } from "@/components/winback/winback-table";
import { EmptyState } from "@/components/shared/empty-state";

export default async function WinbackPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("winBack");

  if (!user.can("communications.send")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const candidates = await getWinbackCandidates();

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {candidates.length === 0 ? (
        <EmptyState icon={UserX} title={t("noCandidatesTitle")} description={t("noCandidatesDescription")} />
      ) : (
        <WinbackTable candidates={candidates} />
      )}
    </div>
  );
}
