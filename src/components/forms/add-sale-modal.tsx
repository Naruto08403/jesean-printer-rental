"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createSale } from "@/actions/sales";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Option = { id: string; label: string };

export function AddSaleModal({ clients }: { clients: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add sale
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New sale">
        <form
          className="space-y-3"
          action={(fd) =>
            startTransition(async () => {
              await createSale(fd);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div>
            <Label>Client</Label>
            <Select name="clientId">
              <option value="">Walk-in</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Total (PHP) *</Label>
            <Input name="totalAmount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Items *</Label>
            <Input name="items" placeholder="e.g. HP 803 Black Ink x2" required />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Saving..." : "Record sale"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
