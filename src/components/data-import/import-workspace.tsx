"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, Upload, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { parseSpreadsheet, type ParsedRow } from "@/lib/import/spreadsheet-parser";
import { mapCustomerRow } from "@/lib/import/customer-row-mapper";
import { mapProductRow } from "@/lib/import/product-row-mapper";
import { mapOrderRow } from "@/lib/import/order-row-mapper";
import { generateTemplateCsv, getTemplateColumns, type ImportEntityType } from "@/lib/import/templates";
import { commitCustomerImportAction, commitProductImportAction, commitOrderImportAction, type ImportActionResult } from "@/app/(dashboard)/data-import/actions";

interface PreviewRow {
  rawRow: ParsedRow;
  ok: boolean;
  error?: string;
  mapped?: unknown;
}

const ENTITY_TYPES: ImportEntityType[] = ["customers", "products", "orders"];

function mapRow(type: ImportEntityType, row: ParsedRow): PreviewRow {
  const result = type === "customers" ? mapCustomerRow(row) : type === "products" ? mapProductRow(row) : mapOrderRow(row);
  return result.success ? { rawRow: row, ok: true, mapped: result.data } : { rawRow: row, ok: false, error: result.error };
}

function downloadTemplate(type: ImportEntityType) {
  const csv = generateTemplateCsv(type);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${type}-template.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportWorkspace() {
  const t = useTranslations("dataImport");
  const [entityType, setEntityType] = useState<ImportEntityType>("customers");
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<ImportActionResult | null>(null);

  function handleEntityTypeChange(next: string) {
    setEntityType(next as ImportEntityType);
    setRows([]);
    setFileName(null);
    setResult(null);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);

    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseSpreadsheet(buffer, file.name);
      setRows(parsed.map((row) => mapRow(entityType, row)));
    } catch {
      toast.error(t("parseError"));
      setRows([]);
    }
  }

  const validRows = rows.filter((r) => r.ok);
  const errorRows = rows.filter((r) => !r.ok);

  function handleImport() {
    startTransition(async () => {
      let res: ImportActionResult;
      if (entityType === "customers") {
        res = await commitCustomerImportAction(validRows.map((r) => r.mapped) as Parameters<typeof commitCustomerImportAction>[0]);
      } else if (entityType === "products") {
        res = await commitProductImportAction(validRows.map((r) => r.mapped) as Parameters<typeof commitProductImportAction>[0]);
      } else {
        res = await commitOrderImportAction(validRows.map((r) => r.mapped) as Parameters<typeof commitOrderImportAction>[0]);
      }
      setResult(res);
      if (res.success) {
        toast.success(t("importDone"));
        setRows([]);
        setFileName(null);
      } else {
        toast.error(res.error ?? t("importFailed"));
      }
    });
  }

  return (
    <Tabs value={entityType} onValueChange={handleEntityTypeChange}>
      <TabsList>
        {ENTITY_TYPES.map((type) => (
          <TabsTrigger key={type} value={type}>
            {t(`entity.${type}`)}
          </TabsTrigger>
        ))}
      </TabsList>

      {ENTITY_TYPES.map((type) => (
        <TabsContent key={type} value={type} className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
            <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => downloadTemplate(type)}>
              <Download className="size-3.5" />
              {t("downloadTemplate")}
            </Button>
            <span className="text-xs text-muted-foreground">{t("expectedColumns", { columns: getTemplateColumns(type).join(", ") })}</span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-4 py-2 text-sm hover:bg-accent/40">
              <Upload className="size-3.5" />
              {fileName && entityType === type ? fileName : t("chooseFile")}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            </label>
          </div>

          {entityType === type && rows.length > 0 ? (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-4" />
                  {t("validCount", { count: validRows.length })}
                </span>
                {errorRows.length > 0 ? (
                  <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <XCircle className="size-4" />
                    {t("errorCount", { count: errorRows.length })}
                  </span>
                ) : null}
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">{t("row")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("details")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono text-xs text-muted-foreground">{index + 2}</TableCell>
                        <TableCell>
                          {row.ok ? (
                            <Badge variant="default" className="text-[10px]">
                              {t("valid")}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px]">
                              {t("invalid")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.ok ? Object.values(row.rawRow).filter(Boolean).slice(0, 3).join(" · ") : row.error}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Button type="button" onClick={handleImport} disabled={isPending || validRows.length === 0}>
                {isPending ? t("importing") : t("confirmImport", { count: validRows.length })}
              </Button>
            </>
          ) : null}

          {result?.success && result.summary ? (
            <div className="rounded-lg border bg-muted/40 p-4 text-sm">
              <p>{t("resultSummary", { success: result.summary.successfulRecords, failed: result.summary.failedRecords })}</p>
              <Link href={`/sync-logs/${result.summary.syncRunId}`} className="text-primary hover:underline">
                {t("viewDetails")}
              </Link>
            </div>
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
