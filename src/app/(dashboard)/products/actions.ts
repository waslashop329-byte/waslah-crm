"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import { createProduct, updateProduct, setProductActive } from "@/lib/services/product-service";

export interface ProductActionState {
  error?: string;
  success?: boolean;
}

const productInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  sku: z.string().trim().max(60).optional(),
  category: z.string().trim().max(80).optional(),
  defaultPrice: z.coerce.number().min(0),
  costPrice: z.coerce.number().min(0).optional(),
});

export async function createProductAction(_prevState: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const user = await requirePermission("products.manage");

  const parsed = productInputSchema.safeParse({
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    category: formData.get("category") || undefined,
    defaultPrice: formData.get("defaultPrice"),
    costPrice: formData.get("costPrice") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await createProduct(user.userId, {
      name: parsed.data.name,
      sku: parsed.data.sku ?? null,
      category: parsed.data.category ?? null,
      defaultPrice: parsed.data.defaultPrice,
      costPrice: parsed.data.costPrice ?? null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to create product" };
  }

  revalidatePath("/products");
  return { success: true };
}

const updateProductSchema = productInputSchema.extend({ productId: z.string().uuid() });

export async function updateProductAction(_prevState: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const user = await requirePermission("products.manage");

  const parsed = updateProductSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    sku: formData.get("sku") || undefined,
    category: formData.get("category") || undefined,
    defaultPrice: formData.get("defaultPrice"),
    costPrice: formData.get("costPrice") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  try {
    await updateProduct(user.userId, parsed.data.productId, {
      name: parsed.data.name,
      sku: parsed.data.sku ?? null,
      category: parsed.data.category ?? null,
      defaultPrice: parsed.data.defaultPrice,
      costPrice: parsed.data.costPrice ?? null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update product" };
  }

  revalidatePath("/products");
  return { success: true };
}

const toggleSchema = z.object({ productId: z.string().uuid(), isActive: z.enum(["true", "false"]).transform((v) => v === "true") });

export async function toggleProductActiveAction(_prevState: ProductActionState, formData: FormData): Promise<ProductActionState> {
  const user = await requirePermission("products.manage");

  const parsed = toggleSchema.safeParse({ productId: formData.get("productId"), isActive: formData.get("isActive") });
  if (!parsed.success) return { error: "Invalid product" };

  try {
    await setProductActive(user.userId, parsed.data.productId, parsed.data.isActive);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to update product" };
  }

  revalidatePath("/products");
  return { success: true };
}
