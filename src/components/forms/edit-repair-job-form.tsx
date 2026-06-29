"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RepairPrinterSource, ServiceStatus } from "@prisma/client";
import { updateRepair, type getRepairFormOptions } from "@/actions/repairs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { sourceLabel } from "@/lib/repair-device";

export type RepairEdit = {
  id: string;
  source: RepairPrinterSource;
  clientId: string | null;
  customerName: string | null;
  printerId: string | null;
  linkedFromRepairId: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  problem: string;
  diagnosis: string | null;
  status: ServiceStatus;
  totalAmount: number;
  isChargeWaived: boolean;
  receivedAt: string;
  completedAt: string;
  notes: string;
  defaultRentalId: string;
};

export function EditRepairJobForm({
  repair,
  options,
  onSaved,
  embedded = false,
}: {
  repair: RepairEdit;
  options: FormOptions;
  onSaved?: () => void;
  embedded?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [printerId, setPrinterId] = useState(repair.printerId ?? "");
  const [rentalId, setRentalId] = useState(repair.defaultRentalId);
  const [brand, setBrand] = useState(repair.brand ?? "");
  const [model, setModel] = useState(repair.model ?? "");
  const [serialNumber, setSerialNumber] = useState(repair.serialNumber ?? "");

  useEffect(() => {
    if (repair.source !== "RENTAL" || !rentalId) return;
    const r = options.rentalPrinters.find((x) => x.rentalId === rentalId);
    if (!r) return;
    setBrand(r.brand ?? "");
    setModel(r.model ?? "");
    setSerialNumber(r.serialNumber ?? "");
    setPrinterId(r.printerId);
  }, [rentalId, repair.source, options.rentalPrinters]);

  useEffect(() => {
    if (repair.source !== "INVENTORY" || !printerId) return;
    const p = options.printers.find((x) => x.id === printerId);
    if (!p) return;
    setBrand(p.brand ?? "");
    setModel(p.model ?? "");
    setSerialNumber(p.serialNumber ?? "");
  }, [printerId, repair.source, options.printers]);

  return (
    <form
      className={embedded ? "grid gap-3 sm:grid-cols-2" : "mt-4 grid gap-3 sm:grid-cols-2"}
      action={(fd) =>
        startTransition(async () => {
          fd.set("isEdit", "true");
          fd.set("source", repair.source);
          fd.set("printerId", printerId);
          fd.set("rentalId", rentalId);
          fd.set("historyRepairId", repair.linkedFromRepairId ?? "");
          fd.set("brand", brand);
          fd.set("model", model);
          fd.set("serialNumber", serialNumber);
          await updateRepair(repair.id, fd);
          router.refresh();
          onSaved?.();
        })
      }
    >
      <input type="hidden" name="isEdit" value="true" />

      <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-sm text-slate-600">
        Source: <strong className="text-slate-800">{sourceLabel(repair.source)}</strong>
      </div>

      {repair.source === "RENTAL" && (
        <div className="sm:col-span-2">
          <Label>Rental printer</Label>
          <Select
            value={rentalId}
            onChange={(e) => setRentalId(e.target.value)}
            className="mt-1"
            required
          >
            <option value="">Select active rental</option>
            {options.rentalPrinters.map((r) => (
              <option key={r.rentalId} value={r.rentalId}>
                {r.label}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-emerald-700">Rental repairs stay no charge.</p>
        </div>
      )}

      {repair.source === "INVENTORY" && (
        <div className="sm:col-span-2">
          <Label>Printer from inventory</Label>
          <Select
            value={printerId}
            onChange={(e) => setPrinterId(e.target.value)}
            className="mt-1"
            required
          >
            <option value="">Select printer</option>
            {options.printers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.isRentalUnit ? " · on rental (no charge)" : ""}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
          Device info
        </p>
      </div>
      <div>
        <Label>Brand</Label>
        <Input
          name="brand"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="mt-1"
          placeholder="Epson, Brother…"
        />
      </div>
      <div>
        <Label>Model</Label>
        <Input
          name="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="mt-1"
          placeholder="L121, L360…"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Serial number</Label>
        <Input
          name="serialNumber"
          value={serialNumber}
          onChange={(e) => setSerialNumber(e.target.value)}
          className="mt-1"
        />
      </div>

      <div>
        <Label>Client</Label>
        <Select name="clientId" defaultValue={repair.clientId ?? ""} className="mt-1">
          <option value="">Walk-in</option>
          {options.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label>Customer name</Label>
        <Input name="customerName" defaultValue={repair.customerName ?? ""} className="mt-1" />
      </div>
      <div className="sm:col-span-2">
        <Label>Problem</Label>
        <Input name="problem" defaultValue={repair.problem} required className="mt-1" />
      </div>
      <div className="sm:col-span-2">
        <Label>Diagnosis</Label>
        <Input name="diagnosis" defaultValue={repair.diagnosis ?? ""} className="mt-1" />
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={repair.status} className="mt-1">
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>
      <div>
        <Label>Price (PHP)</Label>
        <Input
          name="totalAmount"
          type="number"
          step="0.01"
          min="0"
          defaultValue={repair.totalAmount}
          disabled={repair.isChargeWaived}
          className="mt-1"
        />
        {repair.isChargeWaived && <input type="hidden" name="isChargeWaived" value="true" />}
      </div>
      <div>
        <Label>Date received</Label>
        <Input
          name="receivedAt"
          type="date"
          required
          defaultValue={repair.receivedAt}
          className="mt-1"
        />
      </div>
      <div>
        <Label>Date returned / completed</Label>
        <Input
          name="completedAt"
          type="date"
          defaultValue={repair.completedAt}
          className="mt-1"
        />
      </div>
      <div className="sm:col-span-2">
        <Label>Notes</Label>
        <Input name="notes" defaultValue={repair.notes} className="mt-1" />
      </div>
      {printerId && (
        <p className="sm:col-span-2 text-sm">
          <Link
            href={`/dashboard/printers/${printerId}`}
            className="text-brand-600 hover:underline"
          >
            View printer in inventory
          </Link>
        </p>
      )}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
