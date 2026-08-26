import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

// Part 13's loop guard: an automation's action (e.g. create_follow_up) can
// itself dispatch a CRM event (follow_up.created) that triggers *another*
// rule — which could do the same thing back, forever. AsyncLocalStorage lets
// depth travel implicitly through the whole async call chain from one root
// dispatchEvent() call, without threading a `depth` parameter through
// dispatchEvent()'s generic signature (which every non-automation caller
// would then have to know about too).
const storage = new AsyncLocalStorage<{ depth: number }>();

export const MAX_AUTOMATION_DEPTH = 3;

export function getCurrentAutomationDepth(): number {
  return storage.getStore()?.depth ?? 0;
}

export function runAtNextAutomationDepth<T>(fn: () => Promise<T>): Promise<T> {
  const nextDepth = getCurrentAutomationDepth() + 1;
  return storage.run({ depth: nextDepth }, fn);
}
