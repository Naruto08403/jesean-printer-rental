"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RepairPrinterSource, ServiceStatus } from "@prisma/client";
import { updateRepair } from "@/actions/repairs";
import type { getRepairFormOptions } from "@/actions/repairs";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DiagnosisPicker, useDiagnosisSelection } from "@/components/forms/diagnosis-picker";
import { parseDiagnosisString } from "@/lib/repair-diagnosis-catalog";
import { sourceLabel } from "@/lib/repair-device";
import { formatCurrency } from "@/lib/utils";

type FormOptions = Awaited<ReturnType<typeof getRepairFormOptions>>;

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
  const [chargeWaived, setChargeWaived] = useState(repair.isChargeWaived);
  const initialDiagnosis = useMemo(() => {
    const parsed = parseDiagnosisString(repair.diagnosis);
    const byName = new Map(
      options.diagnosisCatalog.map((entry) => [entry.name.trim().toLowerCase(), entry.name])
    );
    const matched: string[] = [];
    const unknown: string[] = [];
    for (const name of parsed) {
      const canonical = byName.get(name.trim().toLowerCase());
      if (canonical) matched.push(canonical);
      else unknown.push(name);
    }
    return { matched, unknown };
  }, [repair.diagnosis, options.diagnosisCatalog]);

  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>(initialDiagnosis.matched);
  const legacyDiagnoses = initialDiagnosis.unknown;

  const autoWaive = repair.source === "RENTAL";
  const isWaived = chargeWaived || autoWaive;
  const { total: diagnosisTotal } = useDiagnosisSelection(
    options.diagnosisCatalog,
    selectedDiagnoses
  );

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

  useEffect(() => {
    if (repair.source !== "WALK_IN" || !printerId) return;
    const p = options.walkInPrinters.find((x) => x.id === printerId);
    if (!p) return;
    setBrand(p.brand ?? "");
    setModel(p.model ?? "");
    setSerialNumber(p.serialNumber ?? "");
  }, [printerId, repair.source, options.walkInPrinters]);

  return (
    <>
      {pending && <LoadingOverlay message="Saving repair…" />}
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
          if (isWaived) {
            fd.set("isChargeWaived", "true");
          }
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
          <Label>Rental fleet printer</Label>
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

      {repair.source === "WALK_IN" && (
        <div className="sm:col-span-2">
          <Label>Walk-in printer</Label>
          <Select
            value={printerId}
            onChange={(e) => setPrinterId(e.target.value)}
            className="mt-1"
          >
            <option value="">Manual device info</option>
            {options.walkInPrinters.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} · {p.ownerLabel}
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
        <div className="mb-1 flex items-center justify-between gap-2">
          <Label>Diagnosis</Label>
          <Link href="/dashboard/repairs/diagnoses" className="text-xs text-brand-600 hover:underline">
            Manage prices
          </Link>
        </div>
        <DiagnosisPicker
          catalog={options.diagnosisCatalog}
          selectedNames={selectedDiagnoses}
          onChange={setSelectedDiagnoses}
        />
        {legacyDiagnoses.length > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            Legacy items not in catalog: {legacyDiagnoses.join(", ")}. Add them under Diagnosis
            prices or clear the selection before saving.
          </p>
        )}
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
        <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
          {isWaived ? (
            <span className="font-medium text-emerald-700">No charge</span>
          ) : (
            <span className="font-medium text-slate-900">{formatCurrency(diagnosisTotal)}</span>
          )}
        </div>
        <p className="mt-1 text-xs text-slate-500">Calculated from selected diagnosis prices.</p>
        {!autoWaive && (
          <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={chargeWaived}
              onChange={(e) => setChargeWaived(e.target.checked)}
            />
            Waive charge (goodwill / warranty)
          </label>
        )}
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
        <Button type="submit" loading={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
    </>
  );
}
