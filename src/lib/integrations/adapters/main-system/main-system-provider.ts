// NOT YET IMPLEMENTED. The real operations system's API endpoints, auth
// scheme, and payload shapes have not been provided — building this adapter
// now would mean inventing an API, which the spec explicitly forbids.
//
// When the real API docs arrive, implement this exactly like
// `adapters/mock/mock-provider.ts`: raw request/response types private to
// this file, a normalizeCustomer/normalizeOrder pair that maps them to
// NormalizedCustomer/NormalizedOrder, and fetchCustomers/fetchOrders/
// fetchUpdatedOrders built on top. Nothing outside this file should need to
// change — the sync engine only knows about the IntegrationProvider interface.
import type { IntegrationProvider, TestConnectionResult } from "@/lib/integrations/core/provider";

export const MAIN_SYSTEM_SOURCE = "main_system";

export function createMainSystemProvider(): IntegrationProvider {
  return {
    source: MAIN_SYSTEM_SOURCE,
    capabilities: ["testConnection"],

    async testConnection(): Promise<TestConnectionResult> {
      return {
        ok: false,
        message: "Main system adapter is not configured yet — no API documentation has been provided.",
      };
    },
  };
}
