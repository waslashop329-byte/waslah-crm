export interface LoyaltyTierConfig {
  name: string;
  minOrders: number;
  minSpend: number;
  sortOrder: number;
}

// Pure — qualifies for a tier when BOTH thresholds are met (orders and
// spend), takes the highest-sortOrder tier the customer qualifies for.
// Every customer qualifies for at least the base tier (min_orders: 0,
// min_spend: 0) by design, so this never returns null for a real customer.
export function calculateLoyaltyTier(customer: { totalOrders: number; totalSpend: number }, tiers: LoyaltyTierConfig[]): LoyaltyTierConfig | null {
  const qualifying = tiers.filter((tier) => customer.totalOrders >= tier.minOrders && customer.totalSpend >= tier.minSpend);
  if (qualifying.length === 0) return null;
  return qualifying.reduce((highest, tier) => (tier.sortOrder > highest.sortOrder ? tier : highest));
}
