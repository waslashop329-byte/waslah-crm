"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NavLinks } from "@/components/layout/sidebar";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("nav");
  const locale = useLocale();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="shrink-0 md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">{t("appName")}</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side={locale === "ar" ? "right" : "left"}
        className="data-[side=left]:w-72 data-[side=right]:w-72 bg-sidebar p-0 text-sidebar-foreground"
      >
        <SheetHeader className="h-14 justify-center border-b">
          <SheetTitle className="text-sm font-semibold tracking-tight text-sidebar-foreground">{t("appName")}</SheetTitle>
        </SheetHeader>
        <nav className="flex-1 space-y-1 overflow-y-auto p-2">
          <NavLinks onNavigate={() => setOpen(false)} />
        </nav>
      </SheetContent>
    </Sheet>
  );
}
