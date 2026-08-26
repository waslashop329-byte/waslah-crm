"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/permissions";
import { getIntegration } from "@/lib/repositories/integration-repository";
import { getProvider } from "@/lib/integrations/core/registry";
import { runIntegrationSync } from "@/lib/integrations/sync/sync-runner";
import { recordAudit } from "@/lib/services/audit-service";
import { z } from "zod";

const integrationIdSchema = z.object({ integrationId: z.string().uuid() });

export interface IntegrationActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

export async function testConnectionAction(_prevState: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  const user = await requirePermission("integrations.manage");

  const parsed = integrationIdSchema.safeParse({ integrationId: formData.get("integrationId") });
  if (!parsed.success) return { error: "Invalid integration" };

  const integration = await getIntegration(parsed.data.integrationId);
  if (!integration) return { error: "Integration not found" };

  const provider = getProvider(integration.provider);
  const result = await provider.testConnection();

  await recordAudit({
    actorId: user.userId,
    action: "integration.test_connection",
    entityType: "integration",
    entityId: integration.id,
    afterData: { ok: result.ok, message: result.message ?? null },
  });

  revalidatePath("/integrations");
  return result.ok ? { success: true, message: result.message ?? "Connection OK" } : { error: result.message ?? "Connection failed" };
}

export async function syncNowAction(_prevState: IntegrationActionState, formData: FormData): Promise<IntegrationActionState> {
  const user = await requirePermission("integrations.manage");

  const parsed = integrationIdSchema.safeParse({ integrationId: formData.get("integrationId") });
  if (!parsed.success) return { error: "Invalid integration" };

  const integration = await getIntegration(parsed.data.integrationId);
  if (!integration) return { error: "Integration not found" };

  try {
    const summary = await runIntegrationSync(integration.id, integration.provider, "manual", user.userId);

    await recordAudit({
      actorId: user.userId,
      action: "integration.sync_triggered",
      entityType: "integration",
      entityId: integration.id,
      afterData: { syncRunId: summary.syncRunId, status: summary.status, total: summary.totalRecords },
    });

    revalidatePath("/integrations");
    revalidatePath("/sync-logs");

    if (summary.status === "failed") {
      return { error: summary.errorSummary ?? "Sync failed" };
    }

    return {
      success: true,
      message: `Synced ${summary.successfulRecords}/${summary.totalRecords} records${summary.failedRecords > 0 ? ` (${summary.failedRecords} failed)` : ""}`,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Sync failed" };
  }
}
