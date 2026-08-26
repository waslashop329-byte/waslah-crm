"use client";

import { format, formatDistanceToNow } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getEventConfig } from "@/components/customers/profile/timeline-event-icon";
import { ScoreHistoryCard } from "@/components/customers/profile/score-history-card";
import { RiskIndicatorsCard } from "@/components/customers/profile/risk-indicators-card";
import { AiSummaryCard } from "@/components/ai/ai-summary-card";
import { AiSuggestionsCard } from "@/components/ai/ai-suggestions-card";
import { ProfitabilityCard } from "@/components/customers/profile/profitability-card";
import { JourneyCard } from "@/components/customers/profile/journey-card";
import { UpsellCard } from "@/components/customers/profile/upsell-card";
import { LoyaltyReferralCard } from "@/components/customers/profile/loyalty-referral-card";
import { ComplaintsCard } from "@/components/customers/profile/complaints-card";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { TimelineEventWithEmployee, NoteWithAuthor } from "@/lib/repositories/customer-detail-repository";
import type { UpsellSuggestion } from "@/lib/repositories/sales-intelligence-repository";
import type { ReferralStats } from "@/lib/repositories/loyalty-repository";
import type { JourneyStage } from "@/lib/intelligence/sales/customer-journey";
import type { CustomerProfitability } from "@/lib/intelligence/economics/customer-profitability";
import type {
  AiCustomerSummaryRow,
  AiSuggestionRow,
  ComplaintRow,
  CustomerAcquisitionRow,
  CustomerAddressRow,
  CustomerPhoneRow,
  CustomerRiskProfileRow,
  CustomerRow,
  FollowUpRow,
  LoyaltyTierRow,
  ScoreHistoryRow,
} from "@/lib/types/database";

interface OverviewTabProps {
  customer: CustomerRow;
  events: TimelineEventWithEmployee[];
  notes: NoteWithAuthor[];
  followUps: FollowUpRow[];
  phones: CustomerPhoneRow[];
  addresses: CustomerAddressRow[];
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

export function OverviewTab({
  customer,
  events,
  notes,
  followUps,
  phones,
  addresses,
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
}: OverviewTabProps) {
  const t = useTranslations("customerProfile.overview");
  const tEvents = useTranslations("customerProfile.events");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);

  const upcomingFollowUps = followUps.filter((f) => f.status === "pending").slice(0, 3);
  const recentNotes = notes.slice(0, 3);
  const recentActivity = events.slice(0, 5);
  const primaryAddress = addresses.find((a) => a.is_primary) ?? addresses[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("recentActivity")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
          ) : (
            <ul className="space-y-2.5">
              {recentActivity.map((event) => {
                const { icon: Icon, label, tone } = getEventConfig(event.event_type, tEvents);
                return (
                  <li key={event.id} className="flex items-center gap-2.5 text-sm">
                    <Icon className={`size-3.5 shrink-0 ${tone}`} />
                    <span className="min-w-0 flex-1 truncate">{event.title ?? label}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(event.created_at), { addSuffix: true, locale: dateLocale })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("upcomingFollowUps")}</CardTitle>
        </CardHeader>
        <CardContent>
          {upcomingFollowUps.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noPendingFollowUps")}</p>
          ) : (
            <ul className="space-y-2">
              {upcomingFollowUps.map((followUp) => (
                <li key={followUp.id} className="text-sm">
                  <p className="font-medium">{followUp.title}</p>
                  <p className="text-xs text-muted-foreground">{t("due", { date: format(new Date(followUp.due_date), "MMM d, yyyy", { locale: dateLocale }) })}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("recentNotes")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noNotesYet")}</p>
          ) : (
            <ul className="space-y-2.5">
              {recentNotes.map((note) => (
                <li key={note.id} className="text-sm">
                  <p className="line-clamp-2 text-muted-foreground">{note.content}</p>
                  <p className="text-xs text-muted-foreground">
                    {note.authorName} · {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: dateLocale })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AiSummaryCard customerId={customer.id} summary={aiSummary} />
      <AiSuggestionsCard customerId={customer.id} suggestions={aiSuggestions} />

      <ScoreHistoryCard customer={customer} history={scoreHistory} />
      <RiskIndicatorsCard profile={riskProfile} customerId={customer.id} />

      {profitability ? <ProfitabilityCard customerId={customer.id} profitability={profitability} acquisition={acquisition} /> : null}
      <JourneyCard stages={journey} />
      <UpsellCard suggestions={upsellSuggestions} />
      <LoyaltyReferralCard
        customerId={customer.id}
        tier={loyaltyTier}
        referralStats={referralStats}
        canEditReferrer={canEditReferrer}
        customers={allCustomers}
      />
      <ComplaintsCard complaints={complaints} />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("contactInformation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          {phones.length === 0 ? <p className="text-muted-foreground">{t("noPhoneNumbers")}</p> : null}
          {phones.map((phone) => (
            <p key={phone.id}>
              {phone.phone} {phone.is_primary ? <span className="text-xs text-muted-foreground">({t("primary")})</span> : null}
            </p>
          ))}
          {primaryAddress ? (
            <p className="pt-1 text-muted-foreground">
              {[primaryAddress.address_line, primaryAddress.city, primaryAddress.governorate].filter(Boolean).join(", ")}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
