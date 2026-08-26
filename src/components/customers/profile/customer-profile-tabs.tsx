"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OverviewTab } from "@/components/customers/profile/overview-tab";
import { TimelineTab } from "@/components/customers/profile/timeline-tab";
import { OrdersTab } from "@/components/customers/profile/orders-tab";
import { NotesTab } from "@/components/customers/profile/notes-tab";
import { FollowUpsTab } from "@/components/customers/profile/follow-ups-tab";
import { AddressesTab } from "@/components/customers/profile/addresses-tab";
import type {
  TimelineEventWithEmployee,
  NoteWithAuthor,
  OrderWithItems,
} from "@/lib/repositories/customer-detail-repository";
import type { CustomerProfitability } from "@/lib/intelligence/economics/customer-profitability";
import type { JourneyStage } from "@/lib/intelligence/sales/customer-journey";
import type { UpsellSuggestion } from "@/lib/repositories/sales-intelligence-repository";
import type { ReferralStats } from "@/lib/repositories/loyalty-repository";
import type {
  AiCustomerSummaryRow,
  AiSuggestionRow,
  CustomerAcquisitionRow,
  CustomerAddressRow,
  CustomerPhoneRow,
  CustomerRiskProfileRow,
  ComplaintRow,
  CustomerRow,
  FollowUpRow,
  LoyaltyTierRow,
  ScoreHistoryRow,
} from "@/lib/types/database";

interface CustomerProfileTabsProps {
  customerId: string;
  customer: CustomerRow;
  events: TimelineEventWithEmployee[];
  orders: OrderWithItems[];
  notes: NoteWithAuthor[];
  followUps: FollowUpRow[];
  phones: CustomerPhoneRow[];
  addresses: CustomerAddressRow[];
  canDeleteNotes: boolean;
  canManageFollowUps: boolean;
  canManageCosts: boolean;
  canAnalyzeCalls: boolean;
  scoreHistory: ScoreHistoryRow[];
  riskProfile: CustomerRiskProfileRow | null;
  aiSummary: AiCustomerSummaryRow | null;
  aiSuggestions: AiSuggestionRow[];
  profitability: CustomerProfitability | null;
  acquisition: CustomerAcquisitionRow | null;
  journey: JourneyStage[];
  upsellSuggestions: UpsellSuggestion[];
  loyaltyTier: LoyaltyTierRow | null;
  referralStats: ReferralStats;
  canEditReferrer: boolean;
  allCustomers: { id: string; full_name: string }[];
  complaints: ComplaintRow[];
}

export function CustomerProfileTabs({
  customerId,
  customer,
  events,
  orders,
  notes,
  followUps,
  phones,
  addresses,
  canDeleteNotes,
  canManageFollowUps,
  canManageCosts,
  canAnalyzeCalls,
  scoreHistory,
  riskProfile,
  aiSummary,
  aiSuggestions,
  profitability,
  acquisition,
  journey,
  upsellSuggestions,
  loyaltyTier,
  referralStats,
  canEditReferrer,
  allCustomers,
  complaints,
}: CustomerProfileTabsProps) {
  const t = useTranslations("customerProfile.tabs");
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">{t("overview")}</TabsTrigger>
        <TabsTrigger value="timeline">{t("timeline")}</TabsTrigger>
        <TabsTrigger value="orders">{t("orders", { count: orders.length })}</TabsTrigger>
        <TabsTrigger value="notes">{t("notes", { count: notes.length })}</TabsTrigger>
        <TabsTrigger value="follow-ups">{t("followUps", { count: followUps.length })}</TabsTrigger>
        <TabsTrigger value="addresses">{t("addresses", { count: addresses.length })}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="pt-4">
        <OverviewTab
          customer={customer}
          events={events}
          notes={notes}
          followUps={followUps}
          phones={phones}
          addresses={addresses}
          scoreHistory={scoreHistory}
          riskProfile={riskProfile}
          aiSummary={aiSummary}
          aiSuggestions={aiSuggestions}
          profitability={profitability}
          acquisition={acquisition}
          journey={journey}
          upsellSuggestions={upsellSuggestions}
          loyaltyTier={loyaltyTier}
          referralStats={referralStats}
          canEditReferrer={canEditReferrer}
          allCustomers={allCustomers}
          complaints={complaints}
        />
      </TabsContent>
      <TabsContent value="timeline" className="pt-4">
        <TimelineTab events={events} />
      </TabsContent>
      <TabsContent value="orders" className="pt-4">
        <OrdersTab orders={orders} canManageCosts={canManageCosts} canAnalyzeCalls={canAnalyzeCalls} />
      </TabsContent>
      <TabsContent value="notes" className="pt-4">
        <NotesTab customerId={customerId} notes={notes} canDelete={canDeleteNotes} />
      </TabsContent>
      <TabsContent value="follow-ups" className="pt-4">
        <FollowUpsTab customerId={customerId} followUps={followUps} canManage={canManageFollowUps} />
      </TabsContent>
      <TabsContent value="addresses" className="pt-4">
        <AddressesTab addresses={addresses} />
      </TabsContent>
    </Tabs>
  );
}
