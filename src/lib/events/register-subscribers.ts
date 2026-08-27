import "server-only";
import { registerScoreRiskSubscriber } from "@/lib/events/subscribers/score-risk-subscriber";
import { registerAutomationSubscriber } from "@/lib/events/subscribers/automation-subscriber";
import { registerNotificationSubscriber } from "@/lib/events/subscribers/notification-subscriber";
import { registerAiStalenessSubscriber } from "@/lib/events/subscribers/ai-staleness-subscriber";
import { registerCampaignSubscriber } from "@/lib/events/subscribers/campaign-subscriber";

// Single place that knows every subscriber module that exists — adding a new
// reaction to a CRM event means adding one more register*Subscriber() call
// here, not hunting through emitter code for where to hook in.
export function registerCoreSubscribers(): void {
  registerScoreRiskSubscriber();
  registerAutomationSubscriber();
  registerNotificationSubscriber();
  registerAiStalenessSubscriber();
  registerCampaignSubscriber();
}
