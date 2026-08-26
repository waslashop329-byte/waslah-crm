import { getTranslations } from "next-intl/server";
import { listCustomers, getAllTags, getAssignableEmployees, type CustomerSortColumn } from "@/lib/repositories/customer-repository";
import type { CustomerStatus, ScoreCategory } from "@/lib/types/database";
import { CustomersToolbar } from "@/components/customers/customers-toolbar";
import { CustomersTable } from "@/components/customers/customers-table";
import { PaginationControls } from "@/components/customers/pagination-controls";

const SORT_COLUMNS: CustomerSortColumn[] = ["last_order_at", "total_spend", "total_orders", "score", "customer_since"];

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const search = first(sp.q);
  const tagIds = first(sp.tags)?.split(",").filter(Boolean);
  const tagNames = first(sp.tagNames)?.split(",").filter(Boolean);
  const status = first(sp.status) as CustomerStatus | undefined;
  const scoreCategory = first(sp.scoreCategory) as ScoreCategory | undefined;
  const sortByRaw = first(sp.sort);
  const sortBy = SORT_COLUMNS.includes(sortByRaw as CustomerSortColumn) ? (sortByRaw as CustomerSortColumn) : "last_order_at";
  const sortDir = first(sp.dir) === "asc" ? "asc" : "desc";
  const page = parseNumber(first(sp.page)) ?? 1;

  const params = {
    search,
    tagIds: tagIds && tagIds.length > 0 ? tagIds : undefined,
    tagNames: tagNames && tagNames.length > 0 ? tagNames : undefined,
    minOrders: parseNumber(first(sp.minOrders)),
    minDelivered: parseNumber(first(sp.minDelivered)),
    minCancelled: parseNumber(first(sp.minCancelled)),
    scoreMin: parseNumber(first(sp.scoreMin)),
    scoreMax: parseNumber(first(sp.scoreMax)),
    scoreCategory,
    lastOrderAfter: first(sp.lastOrderAfter) || undefined,
    createdAfter: first(sp.createdAfter) || undefined,
    cancelledGtDelivered: first(sp.cancelledGtDelivered) === "true" || undefined,
    inactiveSince: first(sp.inactiveSince) || undefined,
    status,
    sortBy,
    sortDir: sortDir as "asc" | "desc",
    page,
  };

  const [{ customers, total, pageSize }, tags, employees, t] = await Promise.all([
    listCustomers(params),
    getAllTags(),
    getAssignableEmployees(),
    getTranslations("customers"),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitleCount", { count: total.toLocaleString() })}</p>
      </div>

      <CustomersToolbar tags={tags} />

      <CustomersTable customers={customers} tags={tags} employees={employees} sortBy={sortBy} sortDir={sortDir} />

      <PaginationControls page={page} pageSize={pageSize} total={total} />
    </div>
  );
}
