import * as XLSX from "xlsx";

// Isomorphic (no "server-only") — used both in the browser (instant preview
// on file select) and again server-side (never trust client-side validation
// alone; the commit action re-parses and re-validates the same file).
// Reads the first sheet only; header row becomes each row object's keys,
// trimmed so "Full Name " and "full name" both map predictably.

export interface ParsedRow {
  [column: string]: string | number | boolean | null;
}

// CSV is plain text with no built-in encoding marker — feeding its raw
// bytes to XLSX.read(..., { type: "array" }) makes it byte-sniff the
// encoding, which mis-detects UTF-8 Arabic text as Latin-1 and corrupts
// every non-ASCII name into mojibake (found live: "محمد سيد" came back as
// "ÙØ­ÙØ¯ Ø³ÙØ¯" — silently, no error, just wrong data going into every
// customer record). An .xlsx/.xls file has no such problem — it's a real
// binary/zip container with Unicode handled internally — so only CSV needs
// the explicit fix: decode its bytes as UTF-8 text ourselves first and feed
// XLSX.read the resulting string instead of raw bytes.
export function parseSpreadsheet(data: ArrayBuffer, fileName?: string): ParsedRow[] {
  const isCsv = fileName?.toLowerCase().endsWith(".csv") ?? false;
  const workbook = isCsv
    ? XLSX.read(new TextDecoder("utf-8").decode(data), { type: "string", cellDates: true })
    : XLSX.read(data, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true });

  return rows.map((row) => {
    const normalized: ParsedRow = {};
    for (const [key, value] of Object.entries(row)) {
      const cleanKey = key.trim();
      if (value instanceof Date) {
        normalized[cleanKey] = value.toISOString();
      } else if (typeof value === "string") {
        normalized[cleanKey] = value.trim();
      } else if (typeof value === "number" || typeof value === "boolean" || value === null) {
        normalized[cleanKey] = value;
      } else {
        normalized[cleanKey] = String(value);
      }
    }
    return normalized;
  });
}

export function readColumn(row: ParsedRow, ...candidateNames: string[]): string | null {
  for (const name of candidateNames) {
    const key = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
    if (key && row[key] !== null && row[key] !== undefined && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
  }
  return null;
}
