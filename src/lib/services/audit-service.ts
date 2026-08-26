import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/types/database";

interface RecordAuditParams {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeData?: Json | null;
  afterData?: Json | null;
}

// Admin client, not the RLS-scoped one: audit_logs intentionally has no
// INSERT policy for the "authenticated" role (only admins/managers can even
// SELECT it) — audit records must always be written by the system, never by
// an ordinary user's own request context, and using the RLS-scoped client
// here made every recordAudit() call a silent no-op since Phase 2.
//
// Best-effort: an audit-log failure should never block the action it's recording.
export async function recordAudit(params: RecordAuditParams): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from("audit_logs").insert({
    actor_id: params.actorId,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    before_data: params.beforeData ?? null,
    after_data: params.afterData ?? null,
  });

  if (error) {
    console.error("Failed to record audit log", { params, error });
  }
}
