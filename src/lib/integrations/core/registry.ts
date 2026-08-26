import type { IntegrationProvider } from "@/lib/integrations/core/provider";
import { createMockProvider, MOCK_SOURCE } from "@/lib/integrations/adapters/mock/mock-provider";
import { createMainSystemProvider, MAIN_SYSTEM_SOURCE } from "@/lib/integrations/adapters/main-system/main-system-provider";

// Adding a real source later (Shopify, EasyOrders, ...) means adding one
// entry here and one adapters/<name> folder — nothing else in the sync
// engine, webhook routes, or UI needs to know a new provider exists.
const PROVIDER_FACTORIES: Record<string, () => IntegrationProvider> = {
  [MOCK_SOURCE]: createMockProvider,
  [MAIN_SYSTEM_SOURCE]: createMainSystemProvider,
};

export function getProvider(source: string): IntegrationProvider {
  const factory = PROVIDER_FACTORIES[source];
  if (!factory) {
    throw new Error(`No integration provider registered for source "${source}"`);
  }
  return factory();
}

export function listRegisteredSources(): string[] {
  return Object.keys(PROVIDER_FACTORIES);
}
