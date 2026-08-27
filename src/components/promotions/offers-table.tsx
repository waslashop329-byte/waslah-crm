import { getTranslations, getLocale } from "next-intl/server";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { OfferActiveToggle } from "@/components/promotions/offer-active-toggle";
import { DeleteOfferButton } from "@/components/promotions/delete-offer-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Gift } from "lucide-react";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { OfferWithTargets } from "@/lib/repositories/promotions-repository";

export async function OffersTable({ offers, canManage }: { offers: OfferWithTargets[]; canManage: boolean }) {
  const t = await getTranslations("promotions.offers");
  const locale = (await getLocale()) as Locale;
  const dateLocale = getDateFnsLocale(locale);

  if (offers.length === 0) {
    return <EmptyState icon={Gift} title={t("noOffersTitle")} description={t("noOffersDescription")} />;
  }

  const now = new Date();

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("name")}</TableHead>
            <TableHead>{t("target")}</TableHead>
            <TableHead>{t("window")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            {canManage ? <TableHead className="w-24" /> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer) => {
            const isCurrentlyOn = offer.is_active && new Date(offer.starts_at) <= now && now <= new Date(offer.ends_at);
            return (
              <TableRow key={offer.id}>
                <TableCell className="text-sm">
                  <p className="font-medium">{offer.name}</p>
                  {offer.description ? <p className="text-xs text-muted-foreground">{offer.description}</p> : null}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {offer.loyaltyTierName ?? offer.segmentName ?? t("anyCustomer")}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(offer.starts_at), "MMM d", { locale: dateLocale })} – {format(new Date(offer.ends_at), "MMM d, yyyy", { locale: dateLocale })}
                </TableCell>
                <TableCell>
                  <Badge variant={isCurrentlyOn ? "default" : "secondary"} className="text-[10px]">
                    {isCurrentlyOn ? t("live") : offer.is_active ? t("scheduled") : t("off")}
                  </Badge>
                </TableCell>
                {canManage ? (
                  <TableCell className="p-2">
                    <div className="flex items-center gap-1.5">
                      <OfferActiveToggle offerId={offer.id} initialActive={offer.is_active} />
                      <DeleteOfferButton offerId={offer.id} offerName={offer.name} />
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
