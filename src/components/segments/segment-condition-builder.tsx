"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEGMENT_FIELDS, SEGMENT_OPERATORS, type SegmentFieldKey, type SegmentOperator } from "@/lib/intelligence/segments/segment-schema";
import { previewSegmentAction } from "@/app/(dashboard)/segments/actions";

interface ConditionRow {
  field: SegmentFieldKey;
  operator: SegmentOperator;
  value: string;
}

const OPERATOR_KEYS: Record<SegmentOperator, string> = {
  equals: "equals",
  not_equals: "notEquals",
  greater_than: "greaterThan",
  greater_than_or_equal: "greaterThanOrEqual",
  less_than: "lessThan",
  less_than_or_equal: "lessThanOrEqual",
  contains: "contains",
  days_since_greater_than: "daysSinceGreaterThan",
  days_since_less_than: "daysSinceLessThan",
};

function operatorsForField(field: SegmentFieldKey): SegmentOperator[] {
  const type = SEGMENT_FIELDS[field].type;
  if (type === "tag") return ["contains"];
  if (type === "date") return ["days_since_greater_than", "days_since_less_than", "equals"];
  return SEGMENT_OPERATORS.filter((op) => op !== "contains" && op !== "days_since_greater_than" && op !== "days_since_less_than");
}

const FIELD_KEYS = Object.keys(SEGMENT_FIELDS) as SegmentFieldKey[];

interface SegmentConditionBuilderProps {
  name: string;
  initialOperator?: "AND" | "OR";
  initialConditions?: ConditionRow[];
}

export function SegmentConditionBuilder({ name, initialOperator = "AND", initialConditions }: SegmentConditionBuilderProps) {
  const t = useTranslations("segments.condition");
  const [logicalOperator, setLogicalOperator] = useState<"AND" | "OR">(initialOperator);
  const [rows, setRows] = useState<ConditionRow[]>(
    initialConditions && initialConditions.length > 0 ? initialConditions : [{ field: "total_orders", operator: "greater_than", value: "3" }],
  );
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const conditionsJson = JSON.stringify({
    operator: logicalOperator,
    conditions: rows.map((row) => ({
      field: row.field,
      operator: row.operator,
      value: SEGMENT_FIELDS[row.field].type === "number" || row.operator.startsWith("days_since") ? Number(row.value) || 0 : row.value,
    })),
  });

  function updateRow(index: number, patch: Partial<ConditionRow>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
    setPreviewCount(null);
  }

  function addRow() {
    setRows((prev) => [...prev, { field: "total_orders", operator: "greater_than", value: "0" }]);
    setPreviewCount(null);
  }

  function updateLogicalOperator(value: "AND" | "OR") {
    setLogicalOperator(value);
    setPreviewCount(null);
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setPreviewCount(null);
  }

  function runPreview() {
    setPreviewError(null);
    const formData = new FormData();
    formData.set("conditionsJson", conditionsJson);
    startTransition(async () => {
      const result = await previewSegmentAction({}, formData);
      if (result.error) setPreviewError(result.error);
      else setPreviewCount(result.previewCount ?? 0);
    });
  }

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={conditionsJson} />

      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">{t("match")}</span>
        <Select value={logicalOperator} onValueChange={(v) => updateLogicalOperator(v as "AND" | "OR")}>
          <SelectTrigger size="sm" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">{t("all")}</SelectItem>
            <SelectItem value="OR">{t("any")}</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">{t("ofFollowing")}</span>
      </div>

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div key={index} className="flex flex-wrap items-center gap-2">
            <Select
              value={row.field}
              onValueChange={(field) => {
                const nextField = field as SegmentFieldKey;
                updateRow(index, { field: nextField, operator: operatorsForField(nextField)[0] });
              }}
            >
              <SelectTrigger size="sm" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_KEYS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {t(`fields.${key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={row.operator} onValueChange={(operator) => updateRow(index, { operator: operator as SegmentOperator })}>
              <SelectTrigger size="sm" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operatorsForField(row.field).map((op) => (
                  <SelectItem key={op} value={op}>
                    {t(`operators.${OPERATOR_KEYS[op]}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={row.value}
              onChange={(e) => updateRow(index, { value: e.target.value })}
              placeholder={t("valuePlaceholder")}
              className="h-8 w-36"
              type={SEGMENT_FIELDS[row.field].type === "number" || row.operator.startsWith("days_since") ? "number" : "text"}
            />

            <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => removeRow(index)} disabled={rows.length === 1}>
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addRow}>
          <Plus className="size-3.5" />
          {t("addCondition")}
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={runPreview} disabled={isPending}>
          {isPending ? t("checking") : t("previewMatches")}
        </Button>
        {previewCount !== null ? <span className="text-sm text-muted-foreground">{t("matchingCustomers", { count: previewCount })}</span> : null}
        {previewError ? <span className="text-sm text-destructive">{previewError}</span> : null}
      </div>
    </div>
  );
}
