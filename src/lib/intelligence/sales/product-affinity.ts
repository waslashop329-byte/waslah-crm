export interface CustomerPurchase {
  customerId: string;
  productId: string;
}

export interface AffinityResult {
  productId: string;
  coCount: number;
}

// Pure — co-purchase counting across each customer's FULL history, not just
// within one order (most orders in this CRM carry a single line item, so
// same-basket affinity would rarely find anything). "Bought A also bought B"
// means both appear anywhere in the same customer's purchase set.
export function calculateProductAffinity(purchases: CustomerPurchase[], targetProductId: string, limit = 5): AffinityResult[] {
  const productsByCustomer = new Map<string, Set<string>>();
  for (const purchase of purchases) {
    const set = productsByCustomer.get(purchase.customerId) ?? new Set<string>();
    set.add(purchase.productId);
    productsByCustomer.set(purchase.customerId, set);
  }

  const coCounts = new Map<string, number>();
  for (const products of productsByCustomer.values()) {
    if (!products.has(targetProductId)) continue;
    for (const productId of products) {
      if (productId === targetProductId) continue;
      coCounts.set(productId, (coCounts.get(productId) ?? 0) + 1);
    }
  }

  return Array.from(coCounts.entries())
    .map(([productId, coCount]) => ({ productId, coCount }))
    .sort((a, b) => b.coCount - a.coCount)
    .slice(0, limit);
}

// For a specific customer: products they haven't bought yet, ranked by total
// affinity score across everything they HAVE bought — the "🎯 Upsell
// Opportunity" surface on the customer profile.
export function suggestUpsellProducts(purchases: CustomerPurchase[], ownedProductIds: Set<string>, limit = 5): AffinityResult[] {
  const scores = new Map<string, number>();

  for (const ownedProductId of ownedProductIds) {
    const related = calculateProductAffinity(purchases, ownedProductId, Number.POSITIVE_INFINITY);
    for (const { productId, coCount } of related) {
      if (ownedProductIds.has(productId)) continue;
      scores.set(productId, (scores.get(productId) ?? 0) + coCount);
    }
  }

  return Array.from(scores.entries())
    .map(([productId, coCount]) => ({ productId, coCount }))
    .sort((a, b) => b.coCount - a.coCount)
    .slice(0, limit);
}
