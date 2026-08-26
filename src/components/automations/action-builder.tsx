"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AUTOMATION_ACTION_TYPES, type AutomationActionType } from "@/lib/intelligence/automation/action-schema";
import type { TagRow } from "@/lib/types/database";

const ACTION_KEYS: Record<AutomationActionType, string> = {
  add_tag: "addTag",
  remove_tag: "removeTag",
  create_follow_up: "createFollowUp",
  assign_employee: "assignEmployee",
  recalculate_score: "recalculateScore",
  create_timeline_event: "createTimelineEvent",
  create_notification: "createNotification",
  send_message: "sendMessage",
};

// Loosely-typed row: fields not relevant to the current `type` are just
// unused, and serialized away when building the final actionsJson payload.
interface ActionRow {
  type: AutomationActionType;
  tagId?: string;
  followUpType?: "call" | "whatsapp" | "general";
  title?: string;
  description?: string;
  daysFromNow?: number;
  priority?: "low" | "medium" | "high" | "urgent";
  employeeId?: string;
  notificationType?: "high_risk_customer" | "duplicate_candidate" | "automation_failed" | "follow_up_assigned";
  message?: string;
  channel?: "whatsapp" | "sms";
  bodyTemplate?: string;
}

function toPayload(row: ActionRow): Record<string, unknown> | null {
  switch (row.type) {
    case "add_tag":
    case "remove_tag":
      return row.tagId ? { type: row.type, tagId: row.tagId } : null;
    case "create_follow_up":
      return row.title
        ? {
            type: "create_follow_up",
            followUpType: row.followUpType ?? "general",
            title: row.title,
            daysFromNow: row.daysFromNow ?? 1,
            priority: row.priority ?? "medium",
          }
        : null;
    case "assign_employee":
      return row.employeeId ? { type: "assign_employee", employeeId: row.employeeId } : null;
    case "recalculate_score":
      return { type: "recalculate_score" };
    case "create_timeline_event":
      return row.title ? { type: "create_timeline_event", title: row.title, description: row.description || undefined } : null;
    case "create_notification":
      return row.title && row.message
        ? { type: "create_notification", notificationType: row.notificationType ?? "follow_up_assigned", title: row.title, message: row.message }
        : null;
    case "send_message":
      return row.bodyTemplate ? { type: "send_message", channel: row.channel ?? "whatsapp", bodyTemplate: row.bodyTemplate } : null;
    default:
      return null;
  }
}

interface ActionBuilderProps {
  name: string;
  tags: TagRow[];
  employees: { id: string; full_name: string }[];
  initialActions?: ActionRow[];
}

export function ActionBuilder({ name, tags, employees, initialActions }: ActionBuilderProps) {
  const t = useTranslations("automations.action");
  const [rows, setRows] = useState<ActionRow[]>(initialActions && initialActions.length > 0 ? initialActions : [{ type: "add_tag" }]);

  const actionsJson = JSON.stringify(rows.map(toPayload).filter((a): a is Record<string, unknown> => a !== null));

  function updateRow(index: number, patch: Partial<ActionRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow() {
    setRows((prev) => [...prev, { type: "add_tag" }]);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={actionsJson} />

      {rows.map((row, index) => (
        <div key={index} className="space-y-2 rounded-md border p-3">
          <div className="flex items-center gap-2">
            <Select value={row.type} onValueChange={(type) => updateRow(index, { type: type as AutomationActionType })}>
              <SelectTrigger size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUTOMATION_ACTION_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {t(ACTION_KEYS[type])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" className="ms-auto size-7" onClick={() => removeRow(index)} disabled={rows.length === 1}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>

          {(row.type === "add_tag" || row.type === "remove_tag") && (
            <Select value={row.tagId} onValueChange={(tagId) => updateRow(index, { tagId })}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder={t("chooseTag")} />
              </SelectTrigger>
              <SelectContent>
                {tags.map((tag) => (
                  <SelectItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {row.type === "create_follow_up" && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder={t("titlePlaceholder")} value={row.title ?? ""} onChange={(e) => updateRow(index, { title: e.target.value })} className="h-8" />
              <Select value={row.followUpType ?? "general"} onValueChange={(v) => updateRow(index, { followUpType: v as ActionRow["followUpType"] })}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">{t("typeCall")}</SelectItem>
                  <SelectItem value="whatsapp">{t("typeWhatsapp")}</SelectItem>
                  <SelectItem value="general">{t("typeGeneral")}</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                placeholder={t("daysFromNowPlaceholder")}
                value={row.daysFromNow ?? ""}
                onChange={(e) => updateRow(index, { daysFromNow: Number(e.target.value) })}
                className="h-8"
              />
              <Select value={row.priority ?? "medium"} onValueChange={(v) => updateRow(index, { priority: v as ActionRow["priority"] })}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{t("priorityLow")}</SelectItem>
                  <SelectItem value="medium">{t("priorityMedium")}</SelectItem>
                  <SelectItem value="high">{t("priorityHigh")}</SelectItem>
                  <SelectItem value="urgent">{t("priorityUrgent")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {row.type === "assign_employee" && (
            <Select value={row.employeeId} onValueChange={(employeeId) => updateRow(index, { employeeId })}>
              <SelectTrigger size="sm" className="w-full">
                <SelectValue placeholder={t("chooseEmployee")} />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.id} value={employee.id}>
                    {employee.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {row.type === "create_timeline_event" && (
            <div className="space-y-2">
              <Input placeholder={t("titlePlaceholder")} value={row.title ?? ""} onChange={(e) => updateRow(index, { title: e.target.value })} className="h-8" />
              <Textarea
                placeholder={t("descriptionPlaceholder")}
                value={row.description ?? ""}
                onChange={(e) => updateRow(index, { description: e.target.value })}
                rows={2}
              />
            </div>
          )}

          {row.type === "create_notification" && (
            <div className="space-y-2">
              <Select value={row.notificationType ?? "follow_up_assigned"} onValueChange={(v) => updateRow(index, { notificationType: v as ActionRow["notificationType"] })}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high_risk_customer">{t("notificationHighRisk")}</SelectItem>
                  <SelectItem value="duplicate_candidate">{t("notificationDuplicate")}</SelectItem>
                  <SelectItem value="automation_failed">{t("notificationAutomationFailed")}</SelectItem>
                  <SelectItem value="follow_up_assigned">{t("notificationFollowUpAssigned")}</SelectItem>
                </SelectContent>
              </Select>
              <Input placeholder={t("titlePlaceholder")} value={row.title ?? ""} onChange={(e) => updateRow(index, { title: e.target.value })} className="h-8" />
              <Textarea placeholder={t("messagePlaceholder")} value={row.message ?? ""} onChange={(e) => updateRow(index, { message: e.target.value })} rows={2} />
            </div>
          )}

          {row.type === "send_message" && (
            <div className="space-y-2">
              <Select value={row.channel ?? "whatsapp"} onValueChange={(v) => updateRow(index, { channel: v as ActionRow["channel"] })}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">{t("channelWhatsapp")}</SelectItem>
                  <SelectItem value="sms">{t("channelSms")}</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder={t("messageBodyPlaceholder")}
                value={row.bodyTemplate ?? ""}
                onChange={(e) => updateRow(index, { bodyTemplate: e.target.value })}
                rows={2}
              />
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
        <Plus className="size-3.5" />
        {t("addAction")}
      </Button>
    </div>
  );
}
