import { arSA, enUS } from "date-fns/locale";
import type { Locale } from "@/i18n/request";

export function getDateFnsLocale(locale: Locale) {
  return locale === "ar" ? arSA : enUS;
}
