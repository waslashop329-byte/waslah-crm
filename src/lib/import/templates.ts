// Plain CSV templates — Excel opens these fine, and it means zero extra
// dependency for generating real .xlsx files just for a blank template.
// Column names match what the row-mappers accept (case-insensitive, English
// or Arabic) via readColumn()'s candidate-name lists.

export type ImportEntityType = "customers" | "products" | "orders";

const TEMPLATES: Record<ImportEntityType, { headers: string[]; exampleRow: string[] }> = {
  customers: {
    headers: ["Full Name", "Phone", "Email", "City", "Governorate"],
    exampleRow: ["Salma Hossam", "01012345678", "salma@example.com", "Cairo", "Cairo"],
  },
  products: {
    headers: ["Name", "SKU", "Category", "Price", "Cost"],
    exampleRow: ["Wireless Earbuds", "WE-100", "Electronics", "899", "450"],
  },
  orders: {
    headers: ["Customer Name", "Customer Phone", "Order Reference", "Product", "Status", "Total Amount", "Order Date"],
    exampleRow: ["Salma Hossam", "01012345678", "ORD-1001", "Wireless Earbuds", "delivered", "899", "2026-07-15"],
  },
};

function toCsvRow(cells: string[]): string {
  return cells.map((cell) => (cell.includes(",") || cell.includes('"') ? `"${cell.replace(/"/g, '""')}"` : cell)).join(",");
}

export function generateTemplateCsv(type: ImportEntityType): string {
  const template = TEMPLATES[type];
  return [toCsvRow(template.headers), toCsvRow(template.exampleRow)].join("\r\n");
}

export function getTemplateColumns(type: ImportEntityType): string[] {
  return TEMPLATES[type].headers;
}
