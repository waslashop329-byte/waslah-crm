import {
  Users,
  UserPlus,
  Repeat,
  Star,
  Gem,
  AlertTriangle,
  ShieldAlert,
  Clock,
  ClockAlert,
  Sparkles,
  Award,
  ThumbsUp,
  UserX,
  Fingerprint,
  Workflow,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Wallet,
  PhoneCall,
  Target,
  Truck,
  RotateCcw,
  Coins,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { getTranslations, getLocale } from "next-intl/server";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { getEventConfig } from "@/components/customers/profile/timeline-event-icon";
import { getDashboardStats, getRecentActivity, getRevenueDeliveryStats } from "@/lib/repositories/dashboard-repository";
import { getTeamConfirmationKpis } from "@/lib/repositories/confirmation-repository";
import { getBusinessProfitSnapshot, getCacBySource } from "@/lib/repositories/profitability-repository";
import { getCurrentUser } from "@/lib/auth/session";
import { listRecentInsights } from "@/lib/ai/services/business-insights-service";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>;
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const canViewInsights = user?.can("ai.insights.view") ?? false;
  const canViewProfit = user?.can("profit.view") ?? false;
  const t = await getTranslations("dashboard");
  const tEvents = await getTranslations("customerProfile.events");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  const [stats, activity, insights, revenueDelivery, confirmationKpis, profitSnapshot, cacBySource] = await Promise.all([
    getDashboardStats(),
    getRecentActivity(),
    canViewInsights ? listRecentInsights(3) : Promise.resolve([]),
    getRevenueDeliveryStats(),
    getTeamConfirmationKpis(),
    canViewProfit ? getBusinessProfitSnapshot() : Promise.resolve(null),
    canViewProfit ? getCacBySource() : Promise.resolve([]),
  ]);

  const noData = t("kpi.noData");

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const ordersHref = (params: Record<string, string>) => `/orders?${new URLSearchParams(params).toString()}`;
  const customersHref = (params: Record<string, string>) => `/customers?${new URLSearchParams(params).toString()}`;

  const deliveredLast30dHref = ordersHref({ status: "delivered", orderedAfter: thirtyDaysAgo });

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div>
        <SectionLabel>{t("sections.revenue")}</SectionLabel>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard label={t("kpi.ordersLast30d")} value={revenueDelivery.ordersLast30d} icon={ShoppingCart} href={ordersHref({ orderedAfter: thirtyDaysAgo })} />
          <KpiCard label={t("kpi.deliveredLast30d")} value={revenueDelivery.deliveredLast30d} icon={Truck} tone="success" href={deliveredLast30dHref} />
          <KpiCard label={t("kpi.revenueLast30d")} value={revenueDelivery.revenueLast30d} icon={DollarSign} tone="success" suffix=" EGP" href={deliveredLast30dHref} />
          <KpiCard label={t("kpi.avgOrderValue")} value={revenueDelivery.aovLast30d} icon={TrendingUp} suffix=" EGP" href={deliveredLast30dHref} />
          <KpiCard label={t("kpi.repeatRevenue")} value={revenueDelivery.repeatRevenueLast30d} icon={Repeat} suffix=" EGP" href={deliveredLast30dHref} />
        </div>
      </div>

      <div>
        <SectionLabel>{t("sections.customers")}</SectionLabel>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label={t("kpi.totalCustomers")} value={stats.totalCustomers} icon={Users} href="/customers" />
          <KpiCard label={t("kpi.newLast30d")} value={stats.newCustomers30d} icon={UserPlus} tone="success" href={customersHref({ createdAfter: thirtyDaysAgo })} />
          <KpiCard label={t("kpi.repeatCustomers")} value={stats.repeatCustomers} icon={Repeat} href={customersHref({ minOrders: "2" })} />
          <KpiCard label={t("kpi.vipCustomers")} value={stats.vipCustomers} icon={Star} tone="success" href={customersHref({ tagNames: "VIP" })} />
          <KpiCard label={t("kpi.excellentCustomers")} value={stats.excellentCustomers} icon={Award} tone="success" href={customersHref({ scoreCategory: "excellent" })} />
          <KpiCard label={t("kpi.trustedCustomers")} value={stats.trustedCustomers} icon={ThumbsUp} tone="success" href={customersHref({ scoreCategory: "trusted" })} />
          <KpiCard label={t("kpi.highValue")} value={stats.highValueCustomers} icon={Gem} tone="success" href={customersHref({ tagNames: "High Value" })} />
          <KpiCard label={t("kpi.atRisk")} value={stats.atRiskCustomers} icon={AlertTriangle} tone="danger" href={customersHref({ scoreCategory: "high_risk" })} />
          <KpiCard
            label={t("kpi.highCancellationRisk")}
            value={stats.highCancellationRiskCustomers}
            icon={ShieldAlert}
            tone="danger"
            href={customersHref({ cancelledGtDelivered: "true" })}
          />
          <KpiCard label={t("kpi.inactive90d")} value={stats.inactiveCustomers} icon={UserX} tone="warning" href={customersHref({ inactiveSince: ninetyDaysAgo })} />
          <KpiCard label={t("kpi.duplicateCandidates")} value={stats.duplicateCandidates} icon={Fingerprint} tone="warning" href="/duplicates" />
          <KpiCard
            label={t("kpi.automationSuccess")}
            value={stats.automationSuccessRate ?? 0}
            icon={Workflow}
            tone={stats.automationSuccessRate === null ? "default" : stats.automationSuccessRate >= 80 ? "success" : "warning"}
            suffix={stats.automationSuccessRate !== null ? "%" : ` (${t("kpi.noRuns")})`}
            href="/automations"
          />
        </div>
      </div>

      <div>
        <SectionLabel>{t("sections.confirmation")}</SectionLabel>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label={t("kpi.assignedLast30d")}
            value={confirmationKpis.assignedOrders}
            icon={ShoppingCart}
            href={ordersHref({ assignedOnly: "true", orderedAfter: thirtyDaysAgo })}
          />
          <KpiCard
            label={t("kpi.confirmationRate")}
            value={confirmationKpis.confirmationRate ?? 0}
            icon={Target}
            tone="success"
            suffix={confirmationKpis.confirmationRate !== null ? "%" : ` (${noData})`}
            href="/confirmation"
          />
          <KpiCard
            label={t("kpi.contactRate")}
            value={confirmationKpis.contactRate ?? 0}
            icon={PhoneCall}
            suffix={confirmationKpis.contactRate !== null ? "%" : ` (${noData})`}
            href="/confirmation"
          />
          <KpiCard label={t("kpi.pendingFollowUps")} value={stats.pendingFollowUps} icon={Clock} tone="warning" href="/follow-ups?status=pending" />
        </div>
      </div>

      <div>
        <SectionLabel>{t("sections.delivery")}</SectionLabel>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard
            label={t("kpi.deliveryRate")}
            value={revenueDelivery.deliveryRate ?? 0}
            icon={Truck}
            tone="success"
            suffix={revenueDelivery.deliveryRate !== null ? "%" : ` (${noData})`}
            href={deliveredLast30dHref}
          />
          <KpiCard
            label={t("kpi.returnRate")}
            value={revenueDelivery.returnRate ?? 0}
            icon={RotateCcw}
            tone="warning"
            suffix={revenueDelivery.returnRate !== null ? "%" : ` (${noData})`}
            href={ordersHref({ status: "returned", orderedAfter: thirtyDaysAgo })}
          />
          <KpiCard label={t("kpi.overdueFollowUps")} value={stats.overdueFollowUps} icon={ClockAlert} tone="danger" href="/follow-ups?overdueOnly=true" />
        </div>
      </div>

      {canViewProfit && profitSnapshot ? (
        <div>
          <SectionLabel>{t("sections.profit")}</SectionLabel>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard label={t("kpi.revenueLast30d")} value={profitSnapshot.revenue} icon={DollarSign} suffix=" EGP" href={deliveredLast30dHref} />
            <KpiCard label={t("kpi.adSpendLast30d")} value={profitSnapshot.adCost} icon={Coins} tone="warning" suffix=" EGP" href={ordersHref({ orderedAfter: thirtyDaysAgo })} />
            <KpiCard label={t("kpi.shippingLast30d")} value={profitSnapshot.shippingCost} icon={Truck} tone="warning" suffix=" EGP" href={ordersHref({ orderedAfter: thirtyDaysAgo })} />
            <KpiCard label={t("kpi.cogsLast30d")} value={profitSnapshot.cogs} icon={Wallet} tone="warning" suffix=" EGP" href={ordersHref({ orderedAfter: thirtyDaysAgo })} />
            <KpiCard label={t("kpi.netProfitLast30d")} value={profitSnapshot.netProfit} icon={TrendingUp} tone="success" suffix=" EGP" href={ordersHref({ orderedAfter: thirtyDaysAgo })} />
          </div>
          {profitSnapshot.ordersMissingCostData > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">{t("ordersExcludedNote", { count: profitSnapshot.ordersMissingCostData })}</p>
          ) : null}

          {cacBySource.length > 0 ? (
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-sm">{t("cacTitle")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("cacSource")}</TableHead>
                      <TableHead className="text-right">{t("cacCustomers")}</TableHead>
                      <TableHead className="text-right">{t("cacAvg")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cacBySource.map((row) => (
                      <TableRow key={row.source}>
                        <TableCell className="text-sm capitalize">{row.source}</TableCell>
                        <TableCell className="text-right tabular-nums">{row.customersAcquired}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.averageCac !== null ? currency.format(row.averageCac) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("recentActivity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("noActivity")}</p>
            ) : (
              <ul className="divide-y">
                {activity.map((item) => {
                  const { icon: Icon, label, tone } = getEventConfig(item.eventType, tEvents);
                  return (
                    <li key={item.id} className="flex items-center gap-3 py-3 text-sm">
                      <Icon className={`size-3.5 shrink-0 ${tone}`} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{item.customerName}</p>
                        <p className="truncate text-muted-foreground">
                          {label}
                          {item.description ? ` — ${item.description}` : ""}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: dateLocale })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              {t("aiInsightsTitle")}
            </CardTitle>
            {canViewInsights ? (
              <Link href="/ai-insights" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                {t("viewAll")}
              </Link>
            ) : null}
          </CardHeader>
          <CardContent>
            {!canViewInsights ? (
              <EmptyState icon={Sparkles} title={t("restricted")} description={t("noAiInsightsPermission")} />
            ) : insights.length === 0 ? (
              <EmptyState icon={Sparkles} title={t("noInsightsYet")} description={t("noInsightsDescription")} />
            ) : (
              <ul className="space-y-3">
                {insights.map((insight) => (
                  <li key={insight.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{insight.title}</p>
                      <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
                        {insight.category.replace("_", " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{insight.fact_summary}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
