import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PieChart, ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listSegments } from "@/lib/repositories/segment-repository";
import { countSegmentMembers } from "@/lib/intelligence/segments/segment-evaluator";
import { SegmentCard } from "@/components/segments/segment-card";
import { SegmentFormDialog } from "@/components/segments/segment-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";

export default async function SegmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("segments");

  if (!user.can("segments.view")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const segments = await listSegments();
  const counts = await Promise.all(
    segments.map(async (segment) => {
      if (!segment.conditions) return 0;
      try {
        return await countSegmentMembers(segment.conditions);
      } catch {
        return 0;
      }
    }),
  );

  const canManage = user.can("segments.manage");

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage ? <SegmentFormDialog mode="create" /> : null}
      </div>

      {segments.length === 0 ? (
        <EmptyState icon={PieChart} title={t("noSegmentsTitle")} description={t("noSegmentsDescription")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {segments.map((segment, index) => (
            <SegmentCard key={segment.id} segment={segment} memberCount={counts[index]} canManage={canManage} />
          ))}
        </div>
      )}
    </div>
  );
}
