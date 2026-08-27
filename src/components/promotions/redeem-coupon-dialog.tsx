"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logRedemptionAction } from "@/app/(dashboard)/promotions/actions";

interface CustomerOption {
  id: string;
  full_name: string;
}

export function RedeemCouponDialog({ couponId, couponCode, customers }: { couponId: string; couponCode: string; customers: CustomerOption[] }) {
  const t = useTranslations("promotions.coupons");
  const [open, setOpen] = useState(false);
  const [customerId, setCustomerId] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    if (!customerId) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set("couponId", couponId);
      formData.set("customerId", customerId);
      const result = await logRedemptionAction({}, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(t("redeemed"));
        setOpen(false);
        setCustomerId("");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" title={t("logRedemption")}>
          <Ticket className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("redeemTitle", { code: couponCode })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("customer")}</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectCustomer")} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSubmit} disabled={isPending || !customerId}>
              {isPending ? t("redeeming") : t("logRedemption")}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
