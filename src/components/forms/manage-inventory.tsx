"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, PackagePlus,Trash2 } from "lucide-react";
import type { InventoryCategory } from "@prisma/client";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DeleteInventoryButton } from "../delete-inventory-button";
import {
  adjustInventoryStock,
  createInventoryProduct,
  updateInventoryProduct,
} from "@/actions/inventory";
import {
  INVENTORY_CATEGORY_LABELS,
  PRINTER_PART_TYPES,
} from "@/lib/inventory";
import { formatCurrency } from "@/lib/utils";

export type InventoryRow = {
  id: string;
  name: string;
  sku: string | null;
  category: InventoryCategory;
  partType: string | null;
  brand: string | null;
  model: string | null;
  quantity: number;
  sellPrice: number;
  costPrice: number | null;
  reorderAt: number | null;
  notes: string | null;
  isActive: boolean;
};

const CATEGORY_OPTIONS = Object.entries(INVENTORY_CATEGORY_LABELS) as [
  InventoryCategory,
  string,
][];

function ProductFormFields({
  item,
  showActive,
}: {
  item?: InventoryRow;
  showActive?: boolean;
}) {
  const [category, setCategory] = useState<InventoryCategory>(
    item?.category ?? "INK"
  );

  return (
    <>
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input
          id="name"
          name="name"
          defaultValue={item?.name ?? ""}
          required
          className="mt-1"
          placeholder="e.g. HP 803 Black Ink"
        />
      </div>
      <div>
        <Label htmlFor="category">Category *</Label>
        <Select
          id="category"
          name="category"
          value={category}
          onChange={(e) => setCategory(e.target.value as InventoryCategory)}
          className="mt-1"
          required
        >
          {CATEGORY_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </div>
      {category === "PRINTER_PART" && (
        <div>
          <Label htmlFor="partType">Part type</Label>
          <Select
            id="partType"
            name="partType"
            defaultValue={item?.partType ?? ""}
            className="mt-1"
          >
            <option value="">Select type</option>
            {PRINTER_PART_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </Select>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="brand">Brand</Label>
          <Input id="brand" name="brand" defaultValue={item?.brand ?? ""} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="model">Model</Label>
          <Input id="model" name="model" defaultValue={item?.model ?? ""} className="mt-1" />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sku">SKU / code</Label>
          <Input id="sku" name="sku" defaultValue={item?.sku ?? ""} className="mt-1" />
        </div>
        <div>
          <Label htmlFor="color">Color</Label>
          <Select
            defaultValue="Black"
            className="mt-1"
            name="color"
            required
          >
            <option value="Black">Black</option>
            <option value="Magenta">Magenta</option>
            <option value="Cyan">Cyan</option>
            <option value="Yellow">Yellow</option>
          </Select>
        </div>
      </div>
      {!item && (
        <div>
          <Label htmlFor="quantity">Starting quantity</Label>
          <Input
            id="quantity"
            name="quantity"
            type="number"
            min="0"
            step="1"
            defaultValue={0}
            className="mt-1"
          />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sellPrice">Sell price (PHP) *</Label>
          <Input
            id="sellPrice"
            name="sellPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item?.sellPrice ?? 0}
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="costPrice">Cost price (PHP)</Label>
          <Input
            id="costPrice"
            name="costPrice"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item?.costPrice ?? ""}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <Label htmlFor="reorderAt">Reorder at (qty)</Label>
        <Input
          id="reorderAt"
          name="reorderAt"
          type="number"
          min="0"
          step="1"
          defaultValue={item?.reorderAt ?? ""}
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="notes">Notes</Label>
        <Input id="notes" name="notes" defaultValue={item?.notes ?? ""} className="mt-1" />
      </div>
      {showActive && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={item?.isActive ?? true} />
          Active (available for sales)
        </label>
      )}
    </>
  );
}

export function ManageInventory({
  items,
  categoryFilter,
}: {
  items: InventoryRow[];
  categoryFilter?: InventoryCategory | "ALL";
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryRow | null>(null);
  const [adjustItem, setAdjustItem] = useState<InventoryRow | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = useMemo(() => {
    if (!categoryFilter || categoryFilter === "ALL") return items;
    return items.filter((item) => item.category === categoryFilter);
  }, [items, categoryFilter]);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add product
        </Button>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add product">
        <form
          className="space-y-3"
          action={(fd) =>
            startTransition(async () => {
              await createInventoryProduct(fd);
              setAddOpen(false);
              router.refresh();
            })
          }
        >
          <ProductFormFields />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Saving…" : "Add"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        title="Edit product"
      >
        {editItem && (
          <form
            className="space-y-3"
            action={(fd) =>
              startTransition(async () => {
                await updateInventoryProduct(editItem.id, fd);
                setEditItem(null);
                router.refresh();
              })
            }
          >
            <ProductFormFields item={editItem} showActive />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditItem(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={Boolean(adjustItem)}
        onClose={() => setAdjustItem(null)}
        title="Adjust stock"
      >
        {adjustItem && (
          <form
            className="space-y-3"
            action={(fd) =>
              startTransition(async () => {
                await adjustInventoryStock(adjustItem.id, fd);
                setAdjustItem(null);
                router.refresh();
              })
            }
          >
            <p className="text-sm text-slate-600">
              {adjustItem.name} · current stock:{" "}
              <span className="font-medium text-slate-900">{adjustItem.quantity}</span>
            </p>
            <div>
              <Label htmlFor="delta">Change (+ add / − remove) *</Label>
              <Input
                id="delta"
                name="delta"
                type="number"
                step="1"
                required
                className="mt-1"
                placeholder="e.g. 10 or -2"
              />
            </div>
            <div>
              <Label htmlFor="adjust-notes">Notes</Label>
              <Input id="adjust-notes" name="notes" className="mt-1" placeholder="Optional reason" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setAdjustItem(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={pending}>
                {pending ? "Updating…" : "Update stock"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Sell price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No products yet.
                </td>
              </tr>
            )}
            {filtered.map((item) => {
              const lowStock =
                item.reorderAt != null && item.quantity <= item.reorderAt;
              return (
                <tr key={item.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {[item.brand, item.model, item.partType, item.color]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {INVENTORY_CATEGORY_LABELS[item.category]}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        lowStock ? "font-semibold text-amber-700" : "text-slate-700"
                      }
                    >
                      {item.quantity}
                    </span>
                    {lowStock && (
                      <span className="ml-2 text-xs text-amber-600">Low</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatCurrency(item.sellPrice)}
                  </td>
                  <td className="px-4 py-3">
                    {item.isActive ? (
                      <span className="text-emerald-700">Active</span>
                    ) : (
                      <span className="text-slate-400">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        title="Adjust stock"
                        onClick={() => setAdjustItem(item)}
                      >
                        <PackagePlus className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        title="Edit"
                        onClick={() => setEditItem(item)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteInventoryButton id={item.id}>
                          <button
                              className="rounded-md border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                      </DeleteInventoryButton>
                      

                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
