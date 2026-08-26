"use server";

import { cookies } from "next/headers";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/i18n/request";

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const cookieStore = await cookies();
  // One year, same as most locale-preference cookies — this is a UI
  // preference, not session/auth state, so a long-lived cookie is fine.
  cookieStore.set(LOCALE_COOKIE, locale satisfies Locale, { maxAge: 60 * 60 * 24 * 365, path: "/" });
}
