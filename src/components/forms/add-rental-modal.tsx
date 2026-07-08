"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createRental } from "@/actions/rentals";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type Option = { id: string; label: string };

export function AddRentalModal({
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
        Add rental
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="New rental" className="max-w-xl">
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              await createRental(fd);
              setOpen(false);
              router.refresh();
            })
          }
        >
          <div>
            <Label>Client *</Label>
            <Select name="clientId" required>
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Printer</Label>
            <Select name="printerId">
              <option value="">None</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Start date *</Label>
            <Input name="startDate" type="date" required />
          </div>
          <div>
            <Label>End date</Label>
            <Input name="endDate" type="date" />
          </div>
          <div>
            <Label>Rate per period (PHP) *</Label>
            <Input name="ratePerPeriod" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Payment schedule *</Label>
            <Select name="paymentSchedule" defaultValue="QUARTERLY">
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Total contract (optional)</Label>
            <Input name="totalContract" type="number" step="0.01" />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Creating..." : "Create rental"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
