"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { InventoryCategory } from "@prisma/client";
import { createSale } from "@/actions/sales";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  INVENTORY_CATEGORY_LABELS,
  formatInventoryProductLabel,
} from "@/lib/inventory";
import { formatCurrency } from "@/lib/utils";

type ClientOption = { id: string; label: string };

type ProductOption = {
  id: string;
  name: string;
  sku: string | null;
  category: InventoryCategory;
  partType: string | null;
  brand: string | null;
  model: string | null;
  quantity: number;
  sellPrice: number;
};

type DraftLine = {
  key: string;
  productId: string;
  qty: number;
  unitPrice: number;
};

function productLabel(product: ProductOption) {
  const category = INVENTORY_CATEGORY_LABELS[product.category];
  const detail = formatInventoryProductLabel(product);
  return `${detail} · ${category} · ${product.quantity} in stock · ${formatCurrency(product.sellPrice)}`;
}

export function AddSaleModal({
  clients,
  products,
}: {
  clients: ClientOption[];
  products: ProductOption[];
}) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const total = useMemo(
    () => lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0),
    [lines]
  );

  function resetForm() {
    setLines([]);
    setError(null);
  }

  function addLine() {
    const first = products.find((product) => product.quantity > 0);
    if (!first) {
      setError("No products with stock available.");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        key: `${first.id}-${Date.now()}`,
        productId: first.id,
        qty: 1,
        unitPrice: first.sellPrice,
      },
    ]);
    setError(null);
  }

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch };
        if (patch.productId) {
          const product = productById.get(patch.productId);
          if (product) next.unitPrice = product.sellPrice;
        }
        return next;
      })
    );
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  function buildFormData(clientId: string, notes: string) {
    const fd = new FormData();
    fd.set("clientId", clientId);
    fd.set("notes", notes);
    fd.set(
      "lines",
      JSON.stringify(
        lines.map((line) => ({
          productId: line.productId,
          qty: line.qty,
          unitPrice: line.unitPrice,
        }))
      )
    );
    return fd;
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add sale
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="New sale"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            if (lines.length === 0) {
              setError("Add at least one product.");
              return;
            }

            const form = event.currentTarget;
            const clientId = String(new FormData(form).get("clientId") || "");
            const notes = String(new FormData(form).get("notes") || "");

            for (const line of lines) {
              const product = productById.get(line.productId);
              if (!product) {
                setError("One or more products are unavailable.");
                return;
              }
              if (line.qty > product.quantity) {
                setError(
                  `Insufficient stock for ${product.name}. Available: ${product.quantity}`
                );
                return;
              }
            }

            startTransition(async () => {
              try {
                await createSale(buildFormData(clientId, notes));
                setOpen(false);
                resetForm();
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save sale");
              }
            });
          }}
        >
          <div>
            <Label>Client</Label>
            <Select name="clientId" className="mt-1">
              <option value="">Walk-in</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Products *</Label>
              <Button type="button" variant="secondary" onClick={addLine}>
                <Plus className="h-3.5 w-3.5" />
                Add line
              </Button>
            </div>

            {lines.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-sm text-slate-500">
                Select inventory products. Stock is deducted when the sale is saved.
              </p>
            )}

            {lines.map((line) => {
              const product = productById.get(line.productId);
              const lineTotal = line.qty * line.unitPrice;
              return (
                <div
                  key={line.key}
                  className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_5rem_6.5rem_auto]"
                >
                  <div>
                    <Label className="text-xs text-slate-500">Product</Label>
                    <Select
                      value={line.productId}
                      onChange={(e) =>
                        updateLine(line.key, { productId: e.target.value })
                      }
                      className="mt-1"
                      required
                    >
                      {products.map((option) => (
                        <option
                          key={option.id}
                          value={option.id}
                          disabled={option.quantity <= 0}
                        >
                          {productLabel(option)}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Qty</Label>
                    <Input
                      type="number"
                      min={1}
                      max={product?.quantity ?? 1}
                      step={1}
                      value={line.qty}
                      onChange={(e) =>
                        updateLine(line.key, { qty: Number(e.target.value) || 1 })
                      }
                      className="mt-1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Unit price</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={line.unitPrice}
                      onChange={(e) =>
                        updateLine(line.key, {
                          unitPrice: Number(e.target.value) || 0,
                        })
                      }
                      className="mt-1"
                      required
                    />
                  </div>
                  <div className="flex items-end justify-between gap-2 sm:flex-col sm:items-end">
                    <p className="text-sm font-medium text-slate-700">
                      {formatCurrency(lineTotal)}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeLine(line.key)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span className="text-sm text-slate-600">Total</span>
            <span className="text-lg font-semibold text-slate-900">
              {formatCurrency(total)}
            </span>
          </div>

          <div>
            <Label>Notes</Label>
            <Input name="notes" className="mt-1" placeholder="Optional" />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" loading={pending} disabled={lines.length === 0}>
              {pending ? "Saving..." : "Record sale"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
