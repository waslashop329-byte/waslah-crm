import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert, MessageCircleWarning } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listComplaints } from "@/lib/repositories/complaints-repository";
import { ComplaintsTable } from "@/components/complaints/complaints-table";
import { EmptyState } from "@/components/shared/empty-state";
import type { ComplaintStatus } from "@/lib/types/database";

export default async function ComplaintsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("complaintsPage");

  if (!user.can("complaints.manage")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const { status } = await searchParams;
  const validStatus = ["open", "in_progress", "resolved", "closed"].includes(status ?? "") ? (status as ComplaintStatus) : undefined;
  const complaints = await listComplaints(validStatus);

  const filters: { label: string; value: ComplaintStatus | undefined }[] = [
    { label: t("filterAll"), value: undefined },
    { label: t("filterOpen"), value: "open" },
    { label: t("filterInProgress"), value: "in_progress" },
    { label: t("filterResolved"), value: "resolved" },
    { label: t("filterClosed"), value: "closed" },
  ];

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex gap-2">
        {filters.map((filter) => (
          <a
            key={filter.label}
            href={filter.value ? `/complaints?status=${filter.value}` : "/complaints"}
            className={`rounded-md border px-3 py-1 text-xs ${validStatus === filter.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {filter.label}
          </a>
        ))}
      </div>

      {complaints.length === 0 ? (
        <EmptyState icon={MessageCircleWarning} title={t("noComplaintsTitle")} description={t("noComplaintsDescription")} />
      ) : (
        <ComplaintsTable complaints={complaints} canManage={user.can("complaints.manage")} />
      )}
    </div>
  );
}
