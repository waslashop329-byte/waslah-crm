// Phase 14 (Confirmation workflow automation): least-loaded distribution for
// the "Auto-assign all" bulk action. Pure and side-effect-free so it can be
// unit-verified before wiring into confirmation-service.ts, same convention
// as every other calculation module in lib/intelligence/.

export interface AgentLoad {
  agentId: string;
  /** Number of orders currently assigned to this agent that aren't confirmed/cancelled yet. */
  load: number;
}

/**
 * Assigns each order (in the given order — callers should pass oldest-first
 * so the queue's existing priority ordering is preserved) to whichever agent
 * currently has the fewest open orders, updating the running load as it goes.
 * A greedy per-order pick rather than a fixed round-robin so agents who
 * already carry a lighter load catch up first, even mid-batch.
 *
 * Returns an empty map (no orders touched) if there are no agents to assign to.
 */
export function distributeOrdersByLoad(orderIds: string[], initialLoads: AgentLoad[]): Map<string, string> {
  const assignments = new Map<string, string>();
  if (initialLoads.length === 0) return assignments;

  // Deep-copy so we never mutate the caller's array.
  const loads = initialLoads.map((l) => ({ ...l }));

  for (const orderId of orderIds) {
    loads.sort((a, b) => a.load - b.load || a.agentId.localeCompare(b.agentId));
    const target = loads[0];
    assignments.set(orderId, target.agentId);
    target.load += 1;
  }

  return assignments;
}
