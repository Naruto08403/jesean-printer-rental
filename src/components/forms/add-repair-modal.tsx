"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createRepair } from "@/actions/repairs";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Option = { id: string; label: string };

export function AddRepairModal({
  clients,
  printers,
}: {
  clients: Option[];
  printers: Option[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add repair
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New repair job" className="max-w-xl">
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              await createRepair(fd);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div>
            <Label>Client *</Label>
            <Select name="clientId" required>
              <option value="">Select</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Printer (optional)</Label>
            <Select name="printerId">
              <option value="">None</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Title *</Label>
            <Input name="title" required />
          </div>
          <div className="sm:col-span-2">
            <Label>Total amount (PHP) *</Label>
            <Input name="totalAmount" type="number" step="0.01" required />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create repair"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
