import { PageHeader } from "@/components/page-header";
import { listInventoryProducts } from "@/actions/inventory";
import { ManageInventory } from "@/components/forms/manage-inventory";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/inventory";
import type { InventoryCategory } from "@prisma/client";
import Link from "next/link";

const FILTERS: { value: InventoryCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  ...(
    Object.entries(INVENTORY_CATEGORY_LABELS) as [InventoryCategory, string][]
  ).map(([value, label]) => ({ value, label })),
];

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category: categoryParam } = await searchParams;
  const categoryFilter =
    categoryParam && categoryParam in INVENTORY_CATEGORY_LABELS
      ? (categoryParam as InventoryCategory)
      : "ALL";

  const products = await listInventoryProducts(true);
  const totalQty = products.reduce((sum, product) => sum + product.quantity, 0);
  const lowStock = products.filter(
    (product) =>
      product.isActive &&
      product.reorderAt != null &&
      product.quantity <= product.reorderAt
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        subtitle={`${products.length} products · ${totalQty} units in stock${lowStock > 0 ? ` · ${lowStock} low` : ""}`}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(({ value, label }) => {
          const active = categoryFilter === value;
          const href =
            value === "ALL"
              ? "/dashboard/inventory"
              : `/dashboard/inventory?category=${value}`;
          return (
            <Link
              key={value}
              href={href}
              className={
                active
                  ? "rounded-full bg-brand-700 px-3 py-1 text-sm font-medium text-white"
                  : "rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:border-brand-300 hover:text-brand-700"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      <ManageInventory
        items={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          partType: product.partType,
          brand: product.brand,
          model: product.model,
          quantity: product.quantity,
          sellPrice: product.sellPrice,
          costPrice: product.costPrice,
          reorderAt: product.reorderAt,
          notes: product.notes,
          isActive: product.isActive,
        }))}
        categoryFilter={categoryFilter}
      />
    </div>
  );
}
