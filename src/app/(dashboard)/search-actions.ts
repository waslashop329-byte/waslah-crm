"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { quickSearchCustomers, type QuickSearchResult } from "@/lib/repositories/customer-repository";

export async function globalSearchAction(query: string): Promise<QuickSearchResult[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  return quickSearchCustomers(trimmed);
}
