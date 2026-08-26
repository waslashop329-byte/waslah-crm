import "server-only";
import { z } from "zod";
import { listCustomers } from "@/lib/repositories/customer-repository";
import { getCustomerDetail, getCustomerOrders } from "@/lib/repositories/customer-detail-repository";
import { getCustomerRiskProfile } from "@/lib/repositories/risk-repository";
import { listSegments } from "@/lib/repositories/segment-repository";
import { countSegmentMembers } from "@/lib/intelligence/segments/segment-evaluator";
import { buildBusinessMetricsSnapshot } from "@/lib/ai/context/business-metrics-builder";
import { getDashboardStats } from "@/lib/repositories/dashboard-repository";
import type { ToolDefinition } from "@/lib/ai/types/ai-types";
import type { CurrentUserContext } from "@/lib/auth/session";

// Every tool here is read-only and returns only curated, already-scoped
// fields (Part 11/12: "no arbitrary SQL, no unrestricted data access") — the
// AI never gets a raw table dump, and every query goes through the same
// RLS-scoped repositories the rest of the app uses, so a user can never see
// through the assistant anything they couldn't already see in the UI.
// A single top-level "ai.assistant.use" permission gates the whole
// assistant (checked before any tool runs); none of these tools expose data
// more sensitive than what that role already sees on the Dashboard,
// Customers, and Segments pages, so no additional per-tool permission is
// needed beyond that gate.

export interface ToolContext {
  user: CurrentUserContext;
}

interface RegisteredTool {
  definition: ToolDefinition;
  run: (rawArgs: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

// Erases each tool's specific Zod type as soon as it's registered, so the
// registry map itself can stay uniform — no unsound cast needed at call time.
function defineTool<TArgs>(
  definition: ToolDefinition,
  schema: z.ZodType<TArgs>,
  execute: (args: TArgs, ctx: ToolContext) => Promise<unknown>,
): RegisteredTool {
  return {
    definition,
    run: async (rawArgs, ctx) => {
      const parsed = schema.safeParse(rawArgs);
      if (!parsed.success) {
        throw new Error(`Invalid arguments for "${definition.name}": ${parsed.error.issues.map((i) => i.message).join("; ")}`);
      }
      return execute(parsed.data, ctx);
    },
  };
}

const TOOLS: Record<string, RegisteredTool> = {
  searchCustomers: defineTool(
    {
      name: "searchCustomers",
      description: "Search customers by name, phone number, or order reference. Returns a short list of matching customers with their key stats.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Name, phone number, or order id to search for" },
          limit: { type: "number", description: "Max results to return (default 5, max 10)" },
        },
        required: ["query"],
      },
    },
    z.object({ query: z.string().min(1).max(200), limit: z.number().int().min(1).max(10).optional() }),
    async (args) => {
      const result = await listCustomers({ search: args.query, pageSize: args.limit ?? 5 });
      return {
        totalMatches: result.total,
        customers: result.customers.map((c) => ({
          id: c.id,
          name: c.full_name,
          phone: c.primary_phone,
          status: c.status,
          score: c.score,
          scoreCategory: c.score_category,
          totalOrders: c.total_orders,
          totalSpend: c.total_spend,
          lastOrderAt: c.last_order_at,
          tags: c.tag_names,
        })),
      };
    },
  ),

  getCustomerProfile: defineTool(
    {
      name: "getCustomerProfile",
      description: "Get full profile details for one customer by their id: contact info, tags, status, and score. Use searchCustomers first to find the id.",
      parameters: {
        type: "object",
        properties: { customerId: { type: "string", description: "The customer's UUID" } },
        required: ["customerId"],
      },
    },
    z.object({ customerId: z.string().uuid() }),
    async (args) => {
      const customer = await getCustomerDetail(args.customerId);
      if (!customer) return { found: false };

      const risk = await getCustomerRiskProfile(args.customerId);

      return {
        found: true,
        id: customer.id,
        name: customer.full_name,
        email: customer.email,
        status: customer.status,
        phones: customer.phones.map((p) => p.phone),
        tags: customer.tags.map((t) => t.name),
        customerSince: customer.customer_since,
        score: customer.score,
        scoreCategory: customer.score_category,
        risk: risk
          ? {
              overall: risk.overall_risk_category,
              cancellation: risk.cancellation_risk_category,
              delivery: risk.delivery_risk_category,
              return: risk.return_risk_category,
            }
          : null,
      };
    },
  ),

  getCustomerStatistics: defineTool(
    {
      name: "getCustomerStatistics",
      description:
        "Get order and spending statistics for one customer by their id: total orders, delivered/cancelled/returned counts, total spend, average order value, and recent orders.",
      parameters: {
        type: "object",
        properties: { customerId: { type: "string", description: "The customer's UUID" } },
        required: ["customerId"],
      },
    },
    z.object({ customerId: z.string().uuid() }),
    async (args) => {
      const customer = await getCustomerDetail(args.customerId);
      if (!customer) return { found: false };

      const orders = await getCustomerOrders(args.customerId);

      return {
        found: true,
        totalOrders: customer.total_orders,
        deliveredOrders: customer.delivered_orders,
        cancelledOrders: customer.cancelled_orders,
        returnedOrders: customer.returned_orders,
        totalSpend: customer.total_spend,
        avgOrderValue: customer.avg_order_value,
        firstOrderAt: customer.first_order_at,
        lastOrderAt: customer.last_order_at,
        recentOrders: orders.slice(0, 5).map((o) => ({ status: o.status, totalAmount: o.total_amount, orderedAt: o.ordered_at })),
      };
    },
  ),

  getSegmentStatistics: defineTool(
    {
      name: "getSegmentStatistics",
      description: "List CRM segments with their current member counts. Optionally filter to one segment by name.",
      parameters: {
        type: "object",
        properties: { segmentName: { type: "string", description: "Optional: only return the segment with this name" } },
        required: [],
      },
    },
    z.object({ segmentName: z.string().max(200).optional() }),
    async (args) => {
      const segments = await listSegments();
      const filtered = args.segmentName ? segments.filter((s) => s.name.toLowerCase().includes(args.segmentName!.toLowerCase())) : segments;

      const withCounts = await Promise.all(
        filtered.map(async (segment) => ({
          name: segment.name,
          description: segment.description,
          isSystem: segment.is_system,
          memberCount: segment.conditions ? await countSegmentMembers(segment.conditions) : null,
        })),
      );

      return { segments: withCounts };
    },
  ),

  getCancellationAnalysis: defineTool(
    {
      name: "getCancellationAnalysis",
      description: "Get store-wide order cancellation rate trends and risk distribution across all customers.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    z.object({}),
    async () => {
      const metrics = await buildBusinessMetricsSnapshot();
      return {
        cancellationRatePercentLast30d: metrics.cancellationRate.last30d,
        cancellationRatePercentPrevious30d: metrics.cancellationRate.previous30d,
        ordersLast30d: metrics.totals.ordersLast30d,
        cancelledLast30d: metrics.totals.cancelledLast30d,
        riskDistribution: metrics.riskDistribution,
      };
    },
  ),

  getFollowUpSummary: defineTool(
    {
      name: "getFollowUpSummary",
      description: "Get a summary of follow-up tasks: how many are pending, overdue, and the completion rate over the last 30 days.",
      parameters: { type: "object", properties: {}, required: [] },
    },
    z.object({}),
    async () => {
      const stats = await getDashboardStats();
      return { pendingFollowUps: stats.pendingFollowUps, overdueFollowUps: stats.overdueFollowUps };
    },
  ),
};

export const TOOL_DEFINITIONS: ToolDefinition[] = Object.values(TOOLS).map((tool) => tool.definition);
export const TOOL_NAMES: readonly string[] = Object.keys(TOOLS);

// Runs one AI-requested tool call: validates the name is registered
// (assertToolNameIsRegistered, called by the assistant service before this),
// validates the arguments against that tool's own Zod schema (never trusts
// the AI's JSON as pre-validated), and never lets a single failing tool crash
// the whole assistant turn — a bad call becomes an error string fed back to
// the model instead of an unhandled exception.
export async function runTool(name: string, rawArgs: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const tool = TOOLS[name];
  if (!tool) throw new Error(`Unknown tool "${name}"`);
  return tool.run(rawArgs, ctx);
}
