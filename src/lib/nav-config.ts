import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  PieChart,
  CalendarClock,
  Sparkles,
  Plug,
  Workflow,
  RefreshCw,
  Settings,
  Fingerprint,
  Bot,
  Gauge,
  Package,
  ShoppingCart,
  PhoneCall,
  LineChart,
  UserX,
  Trophy,
  MessageCircleWarning,
  Megaphone,
  Gift,
} from "lucide-react";

export interface NavItem {
  /** English fallback label — the Sidebar looks up messages.nav[key] first and only falls back to this if a translation is missing. */
  label: string;
  /** Translation key under the "nav" namespace in messages/*.json. */
  key: string;
  href: string;
  icon: LucideIcon;
  /** Set when the module isn't built yet; the page renders an EmptyState instead of a 404. */
  comingInPhase?: number;
  /** Translation key under "nav.sections" — when set, a section header renders directly above this item. */
  section?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", key: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Customers", key: "customers", href: "/customers", icon: Users },
  { label: "Orders", key: "orders", href: "/orders", icon: ShoppingCart },
  { label: "Products", key: "products", href: "/products", icon: Package },
  { label: "Confirmation", key: "confirmation", href: "/confirmation", icon: PhoneCall },
  { label: "Analytics", key: "analytics", href: "/analytics", icon: LineChart },
  { label: "Win-back", key: "winBack", href: "/win-back", icon: UserX },
  { label: "Campaigns", key: "campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Promotions", key: "promotions", href: "/promotions", icon: Gift },
  { label: "Performance", key: "performance", href: "/performance", icon: Trophy },
  { label: "Complaints", key: "complaints", href: "/complaints", icon: MessageCircleWarning, section: "afterSales" },
  { label: "Duplicates", key: "duplicates", href: "/duplicates", icon: Fingerprint },
  { label: "Segments", key: "segments", href: "/segments", icon: PieChart },
  { label: "Follow-ups", key: "followUps", href: "/follow-ups", icon: CalendarClock },
  { label: "AI Insights", key: "aiInsights", href: "/ai-insights", icon: Sparkles },
  { label: "AI Assistant", key: "aiAssistant", href: "/ai-assistant", icon: Bot },
  { label: "AI Usage", key: "aiUsage", href: "/ai-usage", icon: Gauge },
  { label: "Integrations", key: "integrations", href: "/integrations", icon: Plug },
  { label: "Automation", key: "automation", href: "/automations", icon: Workflow },
  { label: "Sync Logs", key: "syncLogs", href: "/sync-logs", icon: RefreshCw },
  { label: "Settings", key: "settings", href: "/settings", icon: Settings },
];
