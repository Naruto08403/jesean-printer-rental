"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPrinter } from "@/actions/printers";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddPrinterModal() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add printer
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add printer">
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              await createPrinter(fd);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div>
            <Label htmlFor="serialNumber">Serial number</Label>
            <Input id="serialNumber" name="serialNumber" />
          </div>
          <div>
            <Label htmlFor="brand">Brand</Label>
            <Input id="brand" name="brand" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="model">Model</Label>
            <Input id="model" name="model" />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="price">Price (PHP)</Label>
            <Input id="price" name="price" type="number" step="0.01" min="0" />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Saving..." : "Add printer"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
