"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createCctv } from "@/actions/cctv";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Option = { id: string; label: string };

export function AddCctvModal({ clients }: { clients: Option[] }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add installation
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New CCTV installation" className="max-w-xl">
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              await createCctv(fd);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div className="sm:col-span-2">
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
            <Label>Total (PHP) *</Label>
            <Input name="totalAmount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Site address</Label>
            <Input name="siteAddress" />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input name="description" />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Creating..." : "Create job"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
