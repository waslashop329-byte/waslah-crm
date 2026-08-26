import "server-only";
import { subscribe } from "@/lib/events/dispatcher";
import { AUTOMATION_TRIGGERS } from "@/lib/intelligence/automation/trigger-schema";
import { runAutomationsForEvent } from "@/lib/intelligence/automation/automation-engine";

// Every trigger a rule could possibly be configured for (see
// trigger-schema.ts, mirrors CrmEventName) gets the same generic handler —
// the actual per-rule matching (trigger_event, conditions) happens inside
// runAutomationsForEvent, not here.
export function registerAutomationSubscriber(): void {
  for (const trigger of AUTOMATION_TRIGGERS) {
    subscribe(trigger, async (payload) => {
      const customerId = "customerId" in payload ? payload.customerId : undefined;
      if (!customerId) return;
      await runAutomationsForEvent(trigger, customerId);
    });
  }
}
