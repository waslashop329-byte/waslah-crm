import {
  UserPlus,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Truck,
  PackageCheck,
  PackageX,
  StickyNote,
  CalendarPlus,
  CalendarCheck,
  Tag as TagIcon,
  TrendingUp,
  Users,
  Sparkles,
  Circle,
  MessageSquare,
  Phone,
  type LucideIcon,
} from "lucide-react";

// Reusable renderer (Phase 2 Part 4): new event types just need one line here,
// nothing else changes — the timeline itself is generic and doesn't special-case types.
const EVENT_CONFIG: Record<string, { icon: LucideIcon; key: string; tone: string }> = {
  "customer.created": { icon: UserPlus, key: "customerCreated", tone: "text-blue-600 dark:text-blue-400" },
  "customer.updated": { icon: Users, key: "customerUpdated", tone: "text-muted-foreground" },
  "order.new": { icon: ShoppingCart, key: "orderNew", tone: "text-blue-600 dark:text-blue-400" },
  "order.pending": { icon: ShoppingCart, key: "orderPending", tone: "text-amber-600 dark:text-amber-400" },
  "order.confirmed": { icon: CheckCircle2, key: "orderConfirmed", tone: "text-blue-600 dark:text-blue-400" },
  "order.processing": { icon: PackageCheck, key: "orderProcessing", tone: "text-blue-600 dark:text-blue-400" },
  "order.shipped": { icon: Truck, key: "orderShipped", tone: "text-blue-600 dark:text-blue-400" },
  "order.delivered": { icon: PackageCheck, key: "orderDelivered", tone: "text-emerald-600 dark:text-emerald-400" },
  "order.cancelled": { icon: XCircle, key: "orderCancelled", tone: "text-red-600 dark:text-red-400" },
  "order.returned": { icon: PackageX, key: "orderReturned", tone: "text-amber-600 dark:text-amber-400" },
  "order.failed_delivery": { icon: PackageX, key: "orderFailedDelivery", tone: "text-red-600 dark:text-red-400" },
  "order.call_attempt": { icon: Phone, key: "orderCallAttempt", tone: "text-blue-600 dark:text-blue-400" },
  "note.created": { icon: StickyNote, key: "noteCreated", tone: "text-muted-foreground" },
  "follow_up.created": { icon: CalendarPlus, key: "followUpCreated", tone: "text-blue-600 dark:text-blue-400" },
  "follow_up.completed": { icon: CalendarCheck, key: "followUpCompleted", tone: "text-emerald-600 dark:text-emerald-400" },
  "tag.added": { icon: TagIcon, key: "tagAdded", tone: "text-blue-600 dark:text-blue-400" },
  "tag.removed": { icon: TagIcon, key: "tagRemoved", tone: "text-muted-foreground" },
  "score.changed": { icon: TrendingUp, key: "scoreChanged", tone: "text-blue-600 dark:text-blue-400" },
  "automation.triggered": { icon: Sparkles, key: "automationTriggered", tone: "text-purple-600 dark:text-purple-400" },
  "communication.sent": { icon: MessageSquare, key: "communicationSent", tone: "text-blue-600 dark:text-blue-400" },
};

export function getEventConfig(eventType: string, t: (key: string) => string) {
  const config = EVENT_CONFIG[eventType];
  if (!config) return { icon: Circle, label: eventType, tone: "text-muted-foreground" };
  return { icon: config.icon, label: t(config.key), tone: config.tone };
}
