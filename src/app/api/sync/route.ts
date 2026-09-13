import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIntegrationSync } from "@/lib/integrations/sync/sync-runner";

// Found live: a real sync run this route delegates to can easily take
// several minutes (per-record network round trips add up — see
// data-import-service.ts's CUSTOMER_CONCURRENCY comment for the same root
// cause), but Vercel's default serverless function timeout is far shorter
// (10s on Hobby) and kills the request outright (504
// FUNCTION_INVOCATION_TIMEOUT) rather than letting it finish — confirmed
// live via the GitHub Actions hourly caller. 60s is the maximum Hobby plan
// allows; a routine hourly-window sync should normally fit well inside it
// once the integration's cursor is caught up, but an unusually large
// backlog (e.g. after this job has been broken for a while) can still
// exceed it — that's a real ceiling of the current plan, not a bug here.
export const maxDuration = 60;

// Provider-independent scheduled-sync entrypoint (Part 10). Auth is a bearer
// secret, not a Supabase session — this is meant to be called by a cron job,
// Trigger.dev, or any other scheduler, none of which have a browser session.
// Whoever calls it just needs the URL and SYNC_API_SECRET; nothing here is
// specific to any one scheduling provider.
//
// GET exists specifically for Vercel Cron, which only ever sends GET and
// auto-attaches `Authorization: Bearer <CRON_SECRET>` (same pattern as
// /api/cron/maintenance) — so this accepts either SYNC_API_SECRET or
// CRON_API_SECRET, matching whichever value the caller was set up with.
// POST is kept for manual/curl/n8n triggering with SYNC_API_SECRET.
//
// Body: {} or omitted -> sync every active integration.
//       { "integrationId": "<uuid>" } -> sync just that one.
export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  const validSecrets = [process.env.SYNC_API_SECRET, process.env.CRON_API_SECRET].filter((secret): secret is string => Boolean(secret));
  if (validSecrets.length === 0) {
    return NextResponse.json({ error: "SYNC_API_SECRET is not configured" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  if (!validSecrets.some((secret) => authHeader === `Bearer ${secret}`)) {
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
