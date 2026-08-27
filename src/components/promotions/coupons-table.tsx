import { getTranslations } from "next-intl/server";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CouponActiveToggle } from "@/components/promotions/coupon-active-toggle";
import { DeleteCouponButton } from "@/components/promotions/delete-coupon-button";
import { RedeemCouponDialog } from "@/components/promotions/redeem-coupon-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Ticket } from "lucide-react";
import type { CouponWithTargets } from "@/lib/repositories/promotions-repository";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });

export async function CouponsTable({
  coupons,
  canManage,
  canRedeem,
  customers,
}: {
  coupons: CouponWithTargets[];
  canManage: boolean;
  canRedeem: boolean;
  customers: { id: string; full_name: string }[];
}) {
  const t = await getTranslations("promotions.coupons");

  if (coupons.length === 0) {
    return <EmptyState icon={Ticket} title={t("noCouponsTitle")} description={t("noCouponsDescription")} />;
  }

  const now = new Date();

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("code")}</TableHead>
            <TableHead>{t("discount")}</TableHead>
            <TableHead>{t("target")}</TableHead>
            <TableHead>{t("usage")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            {canManage || canRedeem ? <TableHead className="w-32" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {coupons.map((coupon) => {
            const expired = coupon.expires_at ? new Date(coupon.expires_at) < now : false;
            const atLimit = coupon.usage_limit !== null && coupon.redemptionCount >= coupon.usage_limit;
            const isRedeemable = coupon.is_active && !expired && !atLimit;

            return (
              <TableRow key={coupon.id}>
                <TableCell className="font-mono text-sm font-medium">{coupon.code}</TableCell>
                <TableCell className="text-sm">
                  {coupon.discount_type === "percentage" ? `${coupon.discount_value}%` : currency.format(coupon.discount_value)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{coupon.loyaltyTierName ?? coupon.segmentName ?? t("anyCustomer")}</TableCell>
                <TableCell className="text-sm tabular-nums text-muted-foreground">
                  {coupon.redemptionCount.toLocaleString("en-US")}
                  {coupon.usage_limit !== null ? ` / ${coupon.usage_limit.toLocaleString("en-US")}` : ` (${t("unlimited")})`}
                </TableCell>
                <TableCell>
                  <Badge variant={isRedeemable ? "default" : "secondary"} className="text-[10px]">
                    {!coupon.is_active ? t("off") : expired ? t("expired") : atLimit ? t("limitReached") : t("active")}
                  </Badge>
                </TableCell>
                {canManage || canRedeem ? (
                  <TableCell className="p-2">
                    <div className="flex items-center gap-1.5">
                      {canRedeem && isRedeemable ? <RedeemCouponDialog couponId={coupon.id} couponCode={coupon.code} customers={customers} /> : null}
                      {canManage ? (
                        <>
                          <CouponActiveToggle couponId={coupon.id} initialActive={coupon.is_active} />
                          <DeleteCouponButton couponId={coupon.id} couponCode={coupon.code} />
                        </>
                      ) : null}
                    </div>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
