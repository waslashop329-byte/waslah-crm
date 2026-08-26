import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { listOrders, type OrderListSortColumn } from "@/lib/repositories/order-repository";
import type { OrderStatus } from "@/lib/types/database";
import { OrdersToolbar } from "@/components/orders/orders-toolbar";
import { OrdersTable } from "@/components/orders/orders-table";
import { PaginationControls } from "@/components/customers/pagination-controls";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("ordersPage");
  const sp = await searchParams;

  const status = first(sp.status) as OrderStatus | undefined;
  const sortBy: OrderListSortColumn = "ordered_at";
  const page = parseNumber(first(sp.page)) ?? 1;

  const params = {
    search: first(sp.q),
    status,
    orderedAfter: first(sp.orderedAfter) || undefined,
    orderedBefore: first(sp.orderedBefore) || undefined,
    assignedOnly: first(sp.assignedOnly) === "true" || undefined,
    sortBy,
    sortDir: "desc" as const,
    page,
  };

  const { orders, total, pageSize } = await listOrders(params);

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitleCount", { count: total.toLocaleString() })}</p>
      </div>

      <OrdersToolbar />

      <OrdersTable orders={orders} />

      <PaginationControls page={page} pageSize={pageSize} total={total} translationNamespace="ordersPage.pagination" />
    </div>
  );
}
