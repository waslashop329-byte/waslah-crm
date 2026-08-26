"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { Sparkles } from "lucide-react";
import type { UpsellSuggestion } from "@/lib/repositories/sales-intelligence-repository";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 0 });

export function UpsellCard({ suggestions }: { suggestions: UpsellSuggestion[] }) {
  const t = useTranslations("customerProfile.upsell");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="size-4" />
          {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <EmptyState icon={Sparkles} title={t("noSuggestionsTitle")} description={t("noSuggestionsDescription")} />
        ) : (
          <ul className="space-y-2">
            {suggestions.map(({ product, coCount }) => (
              <li key={product.id} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{t("boughtTogether", { count: coCount })}</p>
                </div>
                <span className="tabular-nums text-muted-foreground">{currency.format(product.default_price)}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
