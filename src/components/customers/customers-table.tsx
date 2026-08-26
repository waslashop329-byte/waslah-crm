import Link from "next/link";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Users } from "lucide-react";
import { ScoreBadge } from "@/components/customers/score-badge";
import { CustomerQuickActions } from "@/components/customers/customer-quick-actions";
import type { CustomerListViewRow, TagRow } from "@/lib/types/database";
import type { CustomerSortColumn } from "@/lib/repositories/customer-repository";

interface CustomersTableProps {
  customers: CustomerListViewRow[];
  tags: TagRow[];
  employees: { id: string; full_name: string }[];
  sortBy: CustomerSortColumn;
  sortDir: "asc" | "desc";
}

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });

export async function CustomersTable({ customers, tags, employees }: CustomersTableProps) {
  const t = await getTranslations("customers");

  if (customers.length === 0) {
    return <EmptyState icon={Users} title={t("noMatchTitle")} description={t("noMatchDescription")} />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("table.customer")}</TableHead>
            <TableHead>{t("table.phone")}</TableHead>
            <TableHead className="text-right">{t("table.orders")}</TableHead>
            <TableHead className="text-right">{t("table.delivered")}</TableHead>
            <TableHead className="text-right">{t("table.cancelled")}</TableHead>
            <TableHead className="text-right">{t("table.totalSpend")}</TableHead>
            <TableHead>{t("table.lastOrder")}</TableHead>
            <TableHead>{t("table.score")}</TableHead>
            <TableHead>{t("table.tags")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => (
            <TableRow key={customer.id}>
              <TableCell className="max-w-48">
                <Link href={`/customers/${customer.id}`} className="font-medium hover:underline">
                  {customer.full_name}
                </Link>
                {customer.email ? <p className="truncate text-xs text-muted-foreground">{customer.email}</p> : null}
              </TableCell>
              <TableCell className="text-sm tabular-nums text-muted-foreground">{customer.primary_phone ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">{customer.total_orders}</TableCell>
              <TableCell className="text-right tabular-nums">{customer.delivered_orders}</TableCell>
              <TableCell className="text-right tabular-nums">{customer.cancelled_orders}</TableCell>
              <TableCell className="text-right tabular-nums">{currency.format(customer.total_spend)}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {customer.last_order_at ? format(new Date(customer.last_order_at), "MMM d, yyyy") : "—"}
              </TableCell>
              <TableCell>
                <ScoreBadge score={customer.score} category={customer.score_category} />
              </TableCell>
              <TableCell>
                <div className="flex max-w-40 flex-wrap gap-1">
                  {customer.tag_names.slice(0, 2).map((name) => (
                    <Badge key={name} variant="secondary" className="text-[10px]">
                      {name}
                    </Badge>
                  ))}
                  {customer.tag_names.length > 2 ? (
                    <Badge variant="secondary" className="text-[10px]">
                      +{customer.tag_names.length - 2}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <CustomerQuickActions customerId={customer.id} tags={tags} employees={employees} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
