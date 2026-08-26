import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { listDuplicateCandidates } from "@/lib/repositories/duplicate-repository";
import { DuplicatesToolbar } from "@/components/duplicates/duplicates-toolbar";
import { DuplicateCandidatesList } from "@/components/duplicates/duplicate-candidates-list";
import { PaginationControls } from "@/components/customers/pagination-controls";
import { EmptyState } from "@/components/shared/empty-state";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DuplicatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("duplicates");

  if (!user.can("duplicates.view")) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const sp = await searchParams;
  const status = first(sp.status) as "pending" | "ignored" | "merged" | undefined;
  const minConfidence = first(sp.minConfidence) ? Number(first(sp.minConfidence)) : undefined;
  const page = Number(first(sp.page)) || 1;

  const { candidates, total, pageSize } = await listDuplicateCandidates({
    status: status ?? "pending",
    minConfidence,
    page,
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("candidateCount", { count: total.toLocaleString() })}</p>
      </div>

      <DuplicatesToolbar />

      <DuplicateCandidatesList candidates={candidates} canMerge={user.can("duplicates.merge")} />

      <PaginationControls page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
