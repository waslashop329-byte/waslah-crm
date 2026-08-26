import "server-only";
import type { CrmEventName, CrmEventPayloads } from "@/lib/events/event-types";

type Handler<K extends CrmEventName> = (payload: CrmEventPayloads[K]) => Promise<void>;

// In-process pub-sub today (Part 14: "may initially operate inside the
// application process"). Every caller only ever sees subscribe()/
// dispatchEvent() — swapping this file's internals for a real queue
// (Trigger.dev, Redis, SQS) later means zero changes to any emitter or
// subscriber, since both only depend on this module's exported functions,
// never on each other.
const subscribers = new Map<CrmEventName, Handler<CrmEventName>[]>();

export function subscribe<K extends CrmEventName>(event: K, handler: Handler<K>): void {
  const list = (subscribers.get(event) as Handler<K>[] | undefined) ?? [];
  list.push(handler);
  subscribers.set(event, list as Handler<CrmEventName>[]);
}

let subscribersRegistered = false;

// Lazy, idempotent registration on first dispatch — avoids a static import
// cycle (subscriber modules need `subscribe` from this file; this file must
// not statically import them back). Safe under Next.js's process reuse: a
// fresh cold start gets a fresh module scope, so there's never a duplicate
// registration within one process's lifetime.
async function ensureSubscribersRegistered(): Promise<void> {
  if (subscribersRegistered) return;
  subscribersRegistered = true;
  const { registerCoreSubscribers } = await import("@/lib/events/register-subscribers");
  registerCoreSubscribers();
}

// Sequential and isolated: one handler throwing must never stop the others
// or crash the caller — the same guarantee a background queue would give
// (each consumer failing independently), just synchronous for now.
export async function dispatchEvent<K extends CrmEventName>(event: K, payload: CrmEventPayloads[K]): Promise<void> {
  await ensureSubscribersRegistered();

  const handlers = (subscribers.get(event) as Handler<K>[] | undefined) ?? [];
  for (const handler of handlers) {
    try {
      await handler(payload);
    } catch (error) {
      console.error(`Event handler for "${event}" failed`, error);
    }
  }
}
