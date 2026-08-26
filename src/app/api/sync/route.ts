import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIntegrationSync } from "@/lib/integrations/sync/sync-runner";

// Provider-independent scheduled-sync entrypoint (Part 10). Auth is a bearer
// secret, not a Supabase session — this is meant to be called by a cron job,
// Trigger.dev, or any other scheduler, none of which have a browser session.
// Whoever calls it just needs the URL and SYNC_API_SECRET; nothing here is
// specific to any one scheduling provider.
//
// Body: {} or omitted -> sync every active integration.
//       { "integrationId": "<uuid>" } -> sync just that one.
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.SYNC_API_SECRET;
  if (!expectedSecret) {
    return NextResponse.json({ error: "SYNC_API_SECRET is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { integrationId?: string } = {};
  try {
    const rawBody = await request.text();
    if (rawBody) body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const supabase = createAdminClient();

  const integrationsQuery = supabase.from("integrations").select("id, provider").eq("is_active", true);
  const { data: integrations, error } = body.integrationId
    ? await integrationsQuery.eq("id", body.integrationId)
    : await integrationsQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!integrations || integrations.length === 0) {
    return NextResponse.json({ error: "No matching active integration(s)" }, { status: 404 });
  }

  const results = await Promise.all(
    integrations.map(async (integration) => {
      try {
        const summary = await runIntegrationSync(integration.id, integration.provider, "scheduled", null);
        return { integrationId: integration.id, ...summary };
      } catch (error) {
        return {
          integrationId: integration.id,
          status: "failed" as const,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }),
  );

  return NextResponse.json({ results });
}
