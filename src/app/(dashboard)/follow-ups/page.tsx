import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listFollowUps } from "@/lib/repositories/follow-up-repository";
import type { FollowUpStatus } from "@/lib/types/database";
import { FollowUpsToolbar } from "@/components/follow-ups/follow-ups-toolbar";
import { FollowUpsTable } from "@/components/follow-ups/follow-ups-table";
import { PaginationControls } from "@/components/customers/pagination-controls";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default async function FollowUpsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("followUpsPage");
  const sp = await searchParams;

  const status = first(sp.status) as FollowUpStatus | undefined;
  const overdueOnly = first(sp.overdueOnly) === "true";
  const page = parseNumber(first(sp.page)) ?? 1;

  const { followUps, total, pageSize } = await listFollowUps({ status, overdueOnly, page });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <FollowUpsToolbar />

      <FollowUpsTable followUps={followUps} canManage={user.can("follow_ups.complete")} />

      <PaginationControls page={page} pageSize={pageSize} total={total} translationNamespace="followUpsPage.pagination" />
    </div>
  );
}
