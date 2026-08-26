"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus } from "lucide-react";
import { createProductAction, updateProductAction, toggleProductActiveAction, type ProductActionState } from "@/app/(dashboard)/products/actions";
import type { ProductRow } from "@/lib/types/database";

const currency = new Intl.NumberFormat("en-EG", { style: "currency", currency: "EGP", maximumFractionDigits: 2 });
const initialState: ProductActionState = {};

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const t = useTranslations("products");

  return (
    <div className="flex flex-col gap-4">
      <NewProductCard />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("catalog")}</CardTitle>
          <CardDescription>{t("productCount", { count: products.length })}</CardDescription>
        </CardHeader>
        <CardContent>
          {products.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t("noProductsYet")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("sku")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead className="w-28">{t("price")}</TableHead>
                  <TableHead className="w-28">{t("cost")}</TableHead>
                  <TableHead className="w-20">{t("status")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <ProductRowForm key={product.id} product={product} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewProductCard() {
  const [state, formAction, isPending] = useActionState(createProductAction, initialState);
  const t = useTranslations("products");

  useEffect(() => {
    if (state.success) toast.success(t("newProduct"));
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t("newProduct")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-wrap items-end gap-3">
          <Field label={t("name")} name="name" required className="w-48" />
          <Field label={t("sku")} name="sku" className="w-32" />
          <Field label={t("category")} name="category" className="w-36" />
          <Field label={t("price")} name="defaultPrice" type="number" step="0.01" min={0} required className="w-24" />
          <Field label={t("cost")} name="costPrice" type="number" step="0.01" min={0} className="w-24" />
          <Button type="submit" disabled={isPending} className="h-9 gap-1.5">
            <Plus className="size-3.5" />
            {isPending ? t("adding") : t("add")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  name,
  idPrefix = "new",
  type = "text",
  step,
  min,
  required,
  defaultValue,
  className,
}: {
  label: string;
  name: string;
  idPrefix?: string;
  type?: string;
  step?: string;
  min?: number;
  required?: boolean;
  defaultValue?: string | number;
  className?: string;
}) {
  const id = `${idPrefix}-${name}`;
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1 block text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={id} name={name} type={type} step={step} min={min} required={required} defaultValue={defaultValue} className="h-9" />
    </div>
  );
}

function ProductRowForm({ product }: { product: ProductRow }) {
  const [editing, setEditing] = useState(false);
  const [state, formAction, isPending] = useActionState(updateProductAction, initialState);
  const [toggleState, toggleAction, isToggling] = useActionState(toggleProductActiveAction, initialState);
  const t = useTranslations("products");

  useEffect(() => {
    if (state.success) toast.success(`${product.name} ${t("save").toLowerCase()}`);
    if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, product.name]);

  useEffect(() => {
    if (toggleState.error) toast.error(toggleState.error);
  }, [toggleState]);

  if (!editing) {
    return (
      <TableRow>
        <TableCell className="text-sm font-medium">{product.name}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{product.sku ?? "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground">{product.category ?? "—"}</TableCell>
        <TableCell className="tabular-nums">{currency.format(product.default_price)}</TableCell>
        <TableCell className="tabular-nums">{product.cost_price !== null ? currency.format(product.cost_price) : "—"}</TableCell>
        <TableCell>
          <Badge variant={product.is_active ? "secondary" : "outline"} className={product.is_active ? "" : "text-muted-foreground"}>
            {product.is_active ? t("active") : t("inactive")}
          </Badge>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditing(true)}>
              {t("edit")}
            </Button>
            <form action={toggleAction}>
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="isActive" value={String(!product.is_active)} />
              <Button type="submit" size="sm" variant="ghost" className="h-7 px-2 text-xs" disabled={isToggling}>
                {product.is_active ? t("deactivate") : t("activate")}
              </Button>
            </form>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell colSpan={7} className="p-0">
        <form action={formAction} className="flex flex-wrap items-end gap-2 px-3 py-2">
          <input type="hidden" name="productId" value={product.id} />
          <Field label={t("name")} name="name" idPrefix={product.id} defaultValue={product.name} required className="w-40" />
          <Field label={t("sku")} name="sku" idPrefix={product.id} defaultValue={product.sku ?? ""} className="w-28" />
          <Field label={t("category")} name="category" idPrefix={product.id} defaultValue={product.category ?? ""} className="w-32" />
          <Field
            label={t("price")}
            name="defaultPrice"
            idPrefix={product.id}
            type="number"
            step="0.01"
            min={0}
            defaultValue={product.default_price}
            required
            className="w-20"
          />
          <Field
            label={t("cost")}
            name="costPrice"
            idPrefix={product.id}
            type="number"
            step="0.01"
            min={0}
            defaultValue={product.cost_price ?? ""}
            className="w-20"
          />
          <Button type="submit" size="sm" disabled={isPending} className="h-9">
            {isPending ? t("saving") : t("save")}
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => setEditing(false)}>
            {t("cancel")}
          </Button>
        </form>
      </TableCell>
    </TableRow>
  );
}
