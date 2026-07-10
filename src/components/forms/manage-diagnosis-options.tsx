"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createRepairDiagnosisOption,
  deleteRepairDiagnosisOption,
  updateRepairDiagnosisOption,
} from "@/actions/repair-diagnoses";
import { formatCurrency } from "@/lib/utils";

export type DiagnosisRow = {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
  isActive: boolean;
};

function DiagnosisFormFields({
  item,
  showActive,
}: {
  item?: DiagnosisRow;
  showActive?: boolean;
}) {
  return (
    <>
      <div>
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" defaultValue={item?.name ?? ""} required className="mt-1" />
      </div>
      <div>
        <Label htmlFor="price">Price (PHP) *</Label>
        <Input
          id="price"
          name="price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={item?.price ?? 0}
          required
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="sortOrder">Sort order</Label>
        <Input
          id="sortOrder"
          name="sortOrder"
          type="number"
          step="1"
          defaultValue={item?.sortOrder ?? 0}
          className="mt-1"
        />
      </div>
      {showActive && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="isActive" defaultChecked={item?.isActive ?? true} />
          Active (shown in repair forms)
        </label>
      )}
    </>
  );
}

export function ManageDiagnosisOptions({ items }: { items: DiagnosisRow[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<DiagnosisRow | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    startTransition(async () => {
      await deleteRepairDiagnosisOption(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add diagnosis
        </Button>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add diagnosis">
        <form
          className="space-y-3"
          action={(fd) =>
            startTransition(async () => {
              await createRepairDiagnosisOption(fd);
              setAddOpen(false);
              router.refresh();
            })
          }
        >
          <DiagnosisFormFields />
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
        title="Edit diagnosis"
      >
        {editItem && (
          <form
            className="space-y-3"
            action={(fd) =>
              startTransition(async () => {
                await updateRepairDiagnosisOption(editItem.id, fd);
                setEditItem(null);
                router.refresh();
              })
            }
          >
            <DiagnosisFormFields item={editItem} showActive />
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                  No diagnosis options yet.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{item.name}</td>
                <td className="px-4 py-3 text-slate-600">{formatCurrency(item.price)}</td>
                <td className="px-4 py-3 text-slate-600">{item.sortOrder}</td>
                <td className="px-4 py-3 text-slate-600">
                  {item.isActive ? "Active" : "Hidden"}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setEditItem(item)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleDelete(item.id, item.name)}
                      loading={pending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
