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
  // Matches one specific real order-export format (a funnel/COD order tool's
  // export) column-for-column — see order-row-mapper.ts for which of these
  // are actually read vs. just tolerated. Deliberately the one canonical
  // orders template rather than a generic shape, per an explicit ask to
  // stop maintaining a separate hand-rolled layout.
  orders: {
    headers: [
      "ID", "Status", "FullName", "Phone", "City", "Address", "Total Cost", "Product Cost", "Shipping Cost",
      "Coupon", "Coupon Discount", "Product Name", "Variant", "Quantity", "SKU", "Item Price", "CreatedAt",
      "Extra Data", "Extra Data2", "Alt Phone", "Note", "Ref", "Utm Source", "Utm Campaign", "Payment Method",
      "Payment Status", "Funnel ID", "Order ID", "Referral Code", "External Order ID",
    ],
    exampleRow: [
      "122239", "pending", "Salma Hossam", "01012345678", "Cairo", "Nasr City, 12 Al Nour St", "959", "899", "60",
      "", "0", "Wireless Earbuds", "Black", "1", "WE-100", "899", "2026-07-15 12:35",
      "", "", "", "Please call before delivery", "", "fb", "120249566821120660", "cod",
      "", "", "", "", "",
    ],
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
