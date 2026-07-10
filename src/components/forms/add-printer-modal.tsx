"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createPrinter } from "@/actions/printers";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { PrinterType } from "@prisma/client";

export function AddPrinterModal({
  clients,
}: {
  clients: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<PrinterType>("RENTAL");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function resetForm() {
    setType("RENTAL");
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Add printer
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Add printer"
      >
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              fd.set("type", type);
              await createPrinter(fd);
              setOpen(false);
              resetForm();
              router.refresh();
            })
          }
        >
          <div className="sm:col-span-2">
            <Label>Type *</Label>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as PrinterType)}
              className="mt-1"
              required
            >
              <option value="RENTAL">Rental (admin fleet)</option>
              <option value="WALK_IN">Walk-in (client personal)</option>
            </Select>
          </div>

          <div className="sm:col-span-2">
            <Label>Owner *</Label>
            {type === "RENTAL" ? (
              <Input value="Admin" disabled className="mt-1 bg-slate-50" />
            ) : (
              <Select name="ownerClientId" className="mt-1" required>
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {type === "RENTAL"
                ? "Rental fleet printers are owned by admin."
                : "Walk-in printers belong to the selected client."}
            </p>
          </div>

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
            <Button type="submit" loading={pending}>
              {pending ? "Saving..." : "Add printer"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
