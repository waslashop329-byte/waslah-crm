import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// No URL-based locale routing — this is an authenticated internal CRM, not a
// public multi-market site, so the locale lives in a cookie set by the
// topbar's language switcher rather than a `[locale]` route segment (which
// would mean restructuring every existing route under src/app/(dashboard)).
export const SUPPORTED_LOCALES = ["en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "locale";

export function isLocale(value: string | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
