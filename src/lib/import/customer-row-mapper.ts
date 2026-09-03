import { readColumn, type ParsedRow } from "@/lib/import/spreadsheet-parser";
import { normalizePhone } from "@/lib/integrations/normalizers/phone";
import type { NormalizedCustomer } from "@/lib/integrations/types/normalized";

export const IMPORT_SOURCE = "excel_import";

export type RowMapResult<T> = { success: true; data: T } | { success: false; error: string };

// Pure, isomorphic — accepts either English or Arabic header labels so a
// user doesn't have to rename their own columns to match a rigid template
// exactly, without going as far as a full visual column-mapping UI.
export function mapCustomerRow(row: ParsedRow): RowMapResult<NormalizedCustomer> {
  const fullName = readColumn(row, "Full Name", "FullName", "Name", "Customer Name", "الاسم الكامل", "اسم العميل", "الاسم");
  const phoneRaw = readColumn(row, "Phone", "Phone Number", "Customer Phone", "رقم الهاتف", "رقم هاتف العميل", "الهاتف");
  const altPhoneRaw = readColumn(row, "Alt Phone", "Alternate Phone", "هاتف بديل", "رقم بديل");
  const email = readColumn(row, "Email", "البريد الإلكتروني", "الإيميل");
  const addressLine = readColumn(row, "Address", "العنوان");
  const city = readColumn(row, "City", "المدينة");
  const governorate = readColumn(row, "Governorate", "المحافظة");

  if (!fullName) return { success: false, error: "Missing customer name" };
  if (!phoneRaw) return { success: false, error: "Missing phone number" };

  const phone = normalizePhone(phoneRaw);
  if (!phone.normalized) return { success: false, error: `Could not recognize phone number "${phoneRaw}" as a valid Egyptian mobile number` };

  // Spreadsheet libraries auto-convert numeric-looking cells to JS numbers,
  // silently dropping a phone's leading zero before it ever reaches
  // normalizePhone() (e.g. "01099998888" -> 1099998888). Rebuilding the
  // displayed/stored "raw" phone from the already-correct normalized value
  // — rather than trusting whatever text the spreadsheet happened to hand
  // back — means the customer record always shows a real, correctly
  // formatted Egyptian number regardless of how the source cell was typed.
  const localRaw = phone.normalized.startsWith("+20") ? `0${phone.normalized.slice(3)}` : phone.normalized;
  const phones = [{ ...phone, raw: localRaw }];

  // An unparsable alt phone is dropped rather than failing the whole row —
  // it's a secondary contact detail, not the identity the row matches on.
  if (altPhoneRaw) {
    const altPhone = normalizePhone(altPhoneRaw);
    if (altPhone.normalized) {
      const altLocalRaw = altPhone.normalized.startsWith("+20") ? `0${altPhone.normalized.slice(3)}` : altPhone.normalized;
      phones.push({ ...altPhone, raw: altLocalRaw });
    }
  }

  const customer: NormalizedCustomer = {
    source: IMPORT_SOURCE,
    externalId: phone.normalized,
    fullName,
    email: email || null,
    phones,
  };

  if (addressLine || city || governorate) {
    customer.addresses = [{ addressLine: addressLine || city || governorate || "", city: city ?? null, governorate: governorate ?? null, isPrimary: true }];
  }

  return { success: true, data: customer };
}
