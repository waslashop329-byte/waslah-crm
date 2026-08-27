"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface StepRow {
  delayDays: string;
  channel: "whatsapp" | "sms";
  messageTemplate: string;
}

const DEFAULT_ROW: StepRow = { delayDays: "0", channel: "whatsapp", messageTemplate: "" };

export function CampaignStepsBuilder({ name }: { name: string }) {
  const t = useTranslations("campaigns.steps");
  const [rows, setRows] = useState<StepRow[]>([DEFAULT_ROW]);

  const stepsJson = JSON.stringify(
    rows.map((row) => ({ delayDays: Number(row.delayDays) || 0, channel: row.channel, messageTemplate: row.messageTemplate })),
  );

  function updateRow(index: number, patch: Partial<StepRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { ...DEFAULT_ROW }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={stepsJson} />

      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-start gap-2 rounded-md border p-2.5">
          <span className="mt-1.5 shrink-0 font-mono text-xs text-muted-foreground">{t("step", { number: index + 1 })}</span>

          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              min={0}
              max={365}
              value={row.delayDays}
              onChange={(e) => updateRow(index, { delayDays: e.target.value })}
              className="h-8 w-16"
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t("daysAfterEnrollment")}</span>
          </div>

          <Select value={row.channel} onValueChange={(v) => updateRow(index, { channel: v as StepRow["channel"] })}>
            <SelectTrigger size="sm" className="h-8 w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="whatsapp">{t("channelWhatsapp")}</SelectItem>
              <SelectItem value="sms">{t("channelSms")}</SelectItem>
            </SelectContent>
          </Select>

          <Textarea
            value={row.messageTemplate}
            onChange={(e) => updateRow(index, { messageTemplate: e.target.value })}
            placeholder={t("messagePlaceholder")}
            rows={2}
            className="h-16 min-w-48 flex-1 resize-none text-sm"
          />

          <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0" onClick={() => removeRow(index)} disabled={rows.length === 1}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
        <Plus className="size-3.5" />
        {t("addStep")}
      </Button>
    </div>
  );
}
