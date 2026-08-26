"use client";

import { format, isSameDay } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { EmptyState } from "@/components/shared/empty-state";
import { Clock } from "lucide-react";
import { getEventConfig } from "@/components/customers/profile/timeline-event-icon";
import { getDateFnsLocale } from "@/lib/date-locale";
import type { Locale } from "@/i18n/request";
import type { TimelineEventWithEmployee } from "@/lib/repositories/customer-detail-repository";

export function TimelineTab({ events }: { events: TimelineEventWithEmployee[] }) {
  const t = useTranslations("customerProfile.timeline");
  const tEvents = useTranslations("customerProfile.events");
  const locale = useLocale() as Locale;
  const dateLocale = getDateFnsLocale(locale);

  if (events.length === 0) {
    return <EmptyState icon={Clock} title={t("noActivityTitle")} description={t("noActivityDescription")} />;
  }

  const rows = events.map((event, index) => {
    const eventDate = new Date(event.created_at);
    const previousDate = index > 0 ? new Date(events[index - 1].created_at) : null;
    const showDateHeader = !previousDate || !isSameDay(previousDate, eventDate);
    return { event, eventDate, showDateHeader };
  });

  return (
    <div className="space-y-1">
      {rows.map(({ event, eventDate, showDateHeader }) => {
        const { icon: Icon, label, tone } = getEventConfig(event.event_type, tEvents);

        return (
          <div key={event.id}>
            {showDateHeader ? (
              <p className="pb-1 pt-3 text-xs font-medium text-muted-foreground first:pt-0">{format(eventDate, "EEEE, MMM d, yyyy", { locale: dateLocale })}</p>
            ) : null}
            <div className="flex gap-3 py-2">
              <div className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted ${tone}`}>
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-medium">{event.title ?? label}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{format(eventDate, "HH:mm")}</span>
                </div>
                {event.description ? <p className="text-sm text-muted-foreground">{event.description}</p> : null}
                {event.employeeName ? <p className="text-xs text-muted-foreground">{t("by", { name: event.employeeName })}</p> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
