"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { MapPin } from "lucide-react";
import type { CustomerAddressRow } from "@/lib/types/database";

export function AddressesTab({ addresses }: { addresses: CustomerAddressRow[] }) {
  const t = useTranslations("customerProfile.addresses");

  if (addresses.length === 0) {
    return <EmptyState icon={MapPin} title={t("noAddressesTitle")} description={t("noAddressesDescription")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {addresses.map((address) => (
        <div key={address.id} className="rounded-md border p-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{address.label ?? t("defaultLabel")}</p>
            {address.is_primary ? <Badge variant="secondary" className="text-[10px]">{t("primary")}</Badge> : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{address.address_line}</p>
          <p className="text-sm text-muted-foreground">
            {[address.area, address.city, address.governorate].filter(Boolean).join(", ")}
          </p>
          {address.details ? <p className="text-xs text-muted-foreground">{address.details}</p> : null}
        </div>
      ))}
    </div>
  );
}
