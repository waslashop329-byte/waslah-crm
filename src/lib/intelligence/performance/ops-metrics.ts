// Phase 14 (CRM operational metrics) — team-efficiency numbers, distinct from
// the marketing/customer-behavior metrics elsewhere in lib/intelligence/.
// Every average here returns null (never 0) when there's no data to average,
// same "unknown isn't zero" principle used throughout this codebase.

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function hoursBetween(fromIso: string, toIso: string): number {
  return (new Date(toIso).getTime() - new Date(fromIso).getTime()) / (1000 * 60 * 60);
}

export interface OrderFirstResponse {
  orderedAt: string;
  /** ISO timestamp of the earliest call attempt on this order, or null if it's never been attempted. */
  firstAttemptAt: string | null;
}

/** Average hours between an order landing and the first call attempt on it. Orders never attempted are excluded (they're a coverage gap, not a response-time data point). */
export function calculateAvgFirstResponseHours(orders: OrderFirstResponse[]): number | null {
  const hours = orders.filter((o) => o.firstAttemptAt !== null).map((o) => hoursBetween(o.orderedAt, o.firstAttemptAt!));
  return average(hours);
}

export interface ComplaintLifecycle {
  createdAt: string;
  status: string;
  /** Best available proxy for "when it was resolved" — the row's last update, which for a resolved/closed complaint is normally the resolution itself. */
  updatedAt: string;
}

const RESOLVED_STATUSES = new Set(["resolved", "closed"]);

/** Average hours from a complaint being logged to it reaching a resolved/closed status. Open/in_progress complaints are excluded — they have no end timestamp yet. */
export function calculateAvgComplaintResolutionHours(complaints: ComplaintLifecycle[]): number | null {
  const hours = complaints.filter((c) => RESOLVED_STATUSES.has(c.status)).map((c) => hoursBetween(c.createdAt, c.updatedAt));
  return average(hours);
}

export interface AgentWorkload {
  agentId: string;
  openOrders: number;
}

export interface WorkloadBalance {
  maxLoad: number;
  minLoad: number;
  /** maxLoad - minLoad — 0 means perfectly even, a bigger spread means some agent is carrying much more than another. */
  spread: number;
}

/** Snapshot imbalance across agents' current open-order counts. Needs at least one agent; returns null otherwise. */
export function calculateWorkloadBalance(loads: AgentWorkload[]): WorkloadBalance | null {
  if (loads.length === 0) return null;
  const values = loads.map((l) => l.openOrders);
  const maxLoad = Math.max(...values);
  const minLoad = Math.min(...values);
  return { maxLoad, minLoad, spread: maxLoad - minLoad };
}
