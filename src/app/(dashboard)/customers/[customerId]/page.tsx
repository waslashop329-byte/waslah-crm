import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getCustomerDetail,
  getCustomerTimeline,
  getCustomerNotes,
  getCustomerFollowUps,
  getCustomerOrders,
  getCustomerAddresses,
} from "@/lib/repositories/customer-detail-repository";
import { getAllTags, getAssignableEmployees, getCustomersLite } from "@/lib/repositories/customer-repository";
import { getScoreHistory } from "@/lib/repositories/scoring-repository";
import { getCustomerRiskProfile } from "@/lib/repositories/risk-repository";
import { getCustomerSummaryIfExists } from "@/lib/ai/services/customer-summary-service";
import { listPendingSuggestions } from "@/lib/ai/services/next-best-action-service";
import { getCustomerProfitability } from "@/lib/repositories/profitability-repository";
import { getCustomerAcquisition } from "@/lib/services/acquisition-service";
import { getCustomerJourney, getUpsellSuggestions } from "@/lib/repositories/sales-intelligence-repository";
import { getCustomerLoyaltyTier, getReferralStats } from "@/lib/repositories/loyalty-repository";
import { getCustomerComplaints } from "@/lib/repositories/complaints-repository";
import { CustomerHeader } from "@/components/customers/profile/customer-header";
import { CustomerStats } from "@/components/customers/profile/customer-stats";
import { CustomerProfileTabs } from "@/components/customers/profile/customer-profile-tabs";

export default async function CustomerProfilePage({ params }: { params: Promise<{ customerId: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { customerId } = await params;
  const customer = await getCustomerDetail(customerId);
  if (!customer) notFound();

  const [
    events,
    notes,
    followUps,
    orders,
    addresses,
    tags,
    employees,
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
    allCustomers,
    complaints,
  ] = await Promise.all([
    getCustomerTimeline(customerId),
    getCustomerNotes(customerId),
    getCustomerFollowUps(customerId),
    getCustomerOrders(customerId),
    getCustomerAddresses(customerId),
    getAllTags(),
    getAssignableEmployees(),
    getScoreHistory(customerId),
    getCustomerRiskProfile(customerId),
    user.can("ai.summary.view") ? getCustomerSummaryIfExists(customerId) : Promise.resolve(null),
    user.can("ai.summary.view") ? listPendingSuggestions(customerId) : Promise.resolve([]),
    user.can("profit.view") ? getCustomerProfitability(customerId) : Promise.resolve(null),
    user.can("profit.view") ? getCustomerAcquisition(customerId) : Promise.resolve(null),
    getCustomerJourney(customerId),
    getUpsellSuggestions(customerId),
    getCustomerLoyaltyTier(customerId),
    getReferralStats(customerId),
    user.can("customers.edit") ? getCustomersLite(customerId) : Promise.resolve([]),
    getCustomerComplaints(customerId),
  ]);

  return (
    <div className="flex flex-1 flex-col gap-5">
      <CustomerHeader customer={customer} allTags={tags} employees={employees} />
      <CustomerStats customer={customer} />
      <CustomerProfileTabs
        customerId={customerId}
        customer={customer}
        events={events}
        orders={orders}
        notes={notes}
        followUps={followUps}
        phones={customer.phones}
        addresses={addresses}
        canDeleteNotes={user.can("notes.delete")}
        canManageFollowUps={user.can("follow_ups.complete")}
        canManageCosts={user.can("orders.manage_costs")}
        canAnalyzeCalls={user.can("ai.call_analysis.generate")}
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
        canEditReferrer={user.can("customers.edit")}
        allCustomers={allCustomers}
        complaints={complaints}
      />
    </div>
  );
}
