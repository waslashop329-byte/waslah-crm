import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getLoyaltyTiers } from "@/lib/repositories/loyalty-repository";
import { listSegments } from "@/lib/repositories/segment-repository";
import { getCustomersLite } from "@/lib/repositories/customer-repository";
import { listOffers, listCoupons } from "@/lib/repositories/promotions-repository";
import { OffersTable } from "@/components/promotions/offers-table";
import { OfferFormDialog } from "@/components/promotions/offer-form-dialog";
import { CouponsTable } from "@/components/promotions/coupons-table";
import { CouponFormDialog } from "@/components/promotions/coupon-form-dialog";
import { EmptyState } from "@/components/shared/empty-state";

export default async function PromotionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const t = await getTranslations("promotions");
  const canManage = user.can("promotions.manage");
  const canRedeem = user.can("promotions.redeem");

  if (!canManage && !canRedeem) {
    return (
      <div className="flex flex-1 flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <EmptyState icon={ShieldAlert} title={t("restricted")} description={t("noPermission")} />
      </div>
    );
  }

  const [tiers, segments, customers, offers, coupons] = await Promise.all([
    getLoyaltyTiers(),
    listSegments(),
    getCustomersLite(),
    listOffers(),
    listCoupons(),
  ]);

  const segmentOptions = segments.map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("offers.title")}</h2>
          {canManage ? <OfferFormDialog tiers={tiers} segments={segmentOptions} /> : null}
        </div>
        <OffersTable offers={offers} canManage={canManage} />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{t("coupons.title")}</h2>
          {canManage ? <CouponFormDialog tiers={tiers} segments={segmentOptions} /> : null}
        </div>
        <CouponsTable coupons={coupons} canManage={canManage} canRedeem={canRedeem} customers={customers} />
      </div>
    </div>
  );
}
