import { z } from "zod";

const orderStatusEnum = z.enum([
  "new",
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "returned",
  "failed_delivery",
]);

export const normalizedPhoneSchema = z.object({
  raw: z.string().min(1),
  normalized: z.string().nullable(),
  country: z.string().min(2),
});

export const normalizedAddressSchema = z.object({
  addressLine: z.string().min(1),
  city: z.string().nullable().optional(),
  governorate: z.string().nullable().optional(),
  area: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
  isPrimary: z.boolean().optional(),
});

export const normalizedCustomerSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().min(1),
  fullName: z.string().trim().min(1, "Customer name is required"),
  email: z.string().email().nullable().optional(),
  phones: z.array(normalizedPhoneSchema),
  addresses: z.array(normalizedAddressSchema).optional(),
});

export const normalizedLineItemSchema = z.object({
  sku: z.string().nullable(),
  name: z.string().trim().min(1),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
});

export const normalizedOrderSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().min(1),
  // Zod strips any key not listed here during .parse() — found live: every
  // synced order showed external_order_code as null despite the real API
  // returning a code and main-system-provider correctly setting displayCode,
  // because this schema had no entry for it and silently dropped the field
  // before syncOrder() ever saw it.
  displayCode: z.string().nullable().optional(),
  customerExternalId: z.string().min(1),
  externalStatus: z.string().min(1),
  status: orderStatusEnum,
  totalAmount: z.number().min(0, "Order total cannot be negative"),
  productSummary: z.string().nullable().optional(),
  lineItems: z.array(normalizedLineItemSchema).optional(),
  orderedAt: z.string().min(1, "orderedAt is required"),
  confirmedAt: z.string().nullable().optional(),
  shippedAt: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  returnedAt: z.string().nullable().optional(),
});

export const normalizedEmployeeSchema = z.object({
  source: z.string().min(1),
  externalId: z.string().min(1),
  fullName: z.string().trim().min(1),
  email: z.string().email().nullable().optional(),
});

export type ValidationResult<T> = { success: true; data: T } | { success: false; error: string };

export function validateNormalizedCustomer(input: unknown): ValidationResult<z.infer<typeof normalizedCustomerSchema>> {
  const parsed = normalizedCustomerSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return { success: true, data: parsed.data };
}

export function validateNormalizedOrder(input: unknown): ValidationResult<z.infer<typeof normalizedOrderSchema>> {
  const parsed = normalizedOrderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return { success: true, data: parsed.data };
}

// Part 22 (Excel import) — products aren't part of the normalized customer/
// order pipeline, but get the same server-side re-validation discipline.
export const importedProductSchema = z.object({
  name: z.string().trim().min(1, "Product name is required"),
  sku: z.string().nullable(),
  category: z.string().nullable(),
  defaultPrice: z.number().min(0, "Price cannot be negative"),
  costPrice: z.number().min(0, "Cost cannot be negative").nullable(),
});

export function validateImportedProduct(input: unknown): ValidationResult<z.infer<typeof importedProductSchema>> {
  const parsed = importedProductSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
  return { success: true, data: parsed.data };
}
