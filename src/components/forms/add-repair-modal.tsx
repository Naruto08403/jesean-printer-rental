"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createRepair } from "@/actions/repairs";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { RepairPrinterSource } from "@prisma/client";
import type { getRepairFormOptions } from "@/actions/repairs";

type FormOptions = Awaited<ReturnType<typeof getRepairFormOptions>>;

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddRepairModal({ options }: { options: FormOptions }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [source, setSource] = useState<RepairPrinterSource>("WALK_IN");
  const [clientId, setClientId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [printerId, setPrinterId] = useState("");
  const [rentalId, setRentalId] = useState("");
  const [historyRepairId, setHistoryRepairId] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [totalAmount, setTotalAmount] = useState("0");
  const [chargeWaived, setChargeWaived] = useState(false);

  const selectedPrinter = options.printers.find((p) => p.id === printerId);
  const selectedRental = options.rentalPrinters.find((r) => r.rentalId === rentalId);
  const selectedHistory = options.deviceHistory.find((h) => h.id === historyRepairId);

  const autoWaive = useMemo(() => {
    if (source === "RENTAL") return true;
    if (source === "INVENTORY" && selectedPrinter?.isRentalUnit) return true;
    if (source === "HISTORY" && selectedHistory) {
      const inv = options.printers.find(
        (p) =>
          p.isRentalUnit &&
          (selectedHistory.serialNumber
            ? options.rentalPrinters.some(
                (r) =>
                  r.serialNumber?.toLowerCase() === selectedHistory.serialNumber?.toLowerCase()
              )
            : false)
      );
      return Boolean(inv);
    }
    return false;
  }, [source, selectedPrinter, selectedHistory, options]);

  useEffect(() => {
    setChargeWaived(autoWaive);
    if (autoWaive) setTotalAmount("0");
  }, [autoWaive]);

  useEffect(() => {
    if (source === "RENTAL" && selectedRental) {
      setClientId(selectedRental.clientId);
      setCustomerName(selectedRental.clientName);
      setBrand(selectedRental.brand ?? "");
      setModel(selectedRental.model ?? "");
      setSerialNumber(selectedRental.serialNumber ?? "");
      setPrinterId(selectedRental.printerId);
    }
  }, [source, selectedRental]);

  useEffect(() => {
    if (source === "INVENTORY" && selectedPrinter) {
      const p = options.printers.find((x) => x.id === printerId);
      if (!p) return;
      const full = options.rentalPrinters.find((r) => r.printerId === printerId);
      if (full) {
        setClientId(full.clientId);
        setCustomerName(full.clientName);
      }
    }
  }, [source, printerId, selectedPrinter, options]);

  useEffect(() => {
    if (source === "HISTORY" && selectedHistory) {
      setBrand(selectedHistory.brand ?? "");
      setModel(selectedHistory.model ?? "");
      setSerialNumber(selectedHistory.serialNumber ?? "");
      setCustomerName(selectedHistory.customerName ?? selectedHistory.clientName ?? "");
    }
  }, [source, selectedHistory]);

  function resetForm() {
    setSource("WALK_IN");
    setClientId("");
    setCustomerName("");
    setPrinterId("");
    setRentalId("");
    setHistoryRepairId("");
    setBrand("");
    setModel("");
    setSerialNumber("");
    setTotalAmount("0");
    setChargeWaived(false);
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Accept repair
      </Button>
      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="Accept printer for repair" className="max-w-2xl">
        <p className="mb-4 text-sm text-slate-600">
          Track rental units (no charge), inventory printers, walk-ins, and repeat devices from repair history.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              fd.set("source", source);
              fd.set("clientId", clientId);
              fd.set("customerName", customerName);
              fd.set("printerId", printerId);
              fd.set("rentalId", rentalId);
              fd.set("historyRepairId", historyRepairId);
              if (source === "INVENTORY" && printerId) {
                const p = options.printers.find((x) => x.id === printerId);
                if (p) {
                  fd.set("brand", p.brand ?? "");
                  fd.set("model", p.model ?? "");
                  fd.set("serialNumber", p.serialNumber ?? "");
                }
              } else {
                fd.set("brand", brand);
                fd.set("model", model);
                fd.set("serialNumber", serialNumber);
              }
              if (chargeWaived || autoWaive) {
                fd.set("isChargeWaived", "true");
                fd.set("totalAmount", "0");
              }
              await createRepair(fd);
              setOpen(false);
              resetForm();
              router.refresh();
            })
          }
        >
          <div className="sm:col-span-2">
            <Label>Printer source *</Label>
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value as RepairPrinterSource)}
              className="mt-1"
            >
              <option value="RENTAL">My rental unit (no repair charge)</option>
              <option value="INVENTORY">From printer inventory</option>
              <option value="WALK_IN">Walk-in / customer-owned printer</option>
              <option value="HISTORY">From previous repair record</option>
            </Select>
          </div>

          {source === "RENTAL" && (
            <div className="sm:col-span-2">
              <Label>Rental printer *</Label>
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
              <p className="mt-1 text-xs text-emerald-700">Rental repairs are free (charge waived).</p>
            </div>
          )}

          {source === "INVENTORY" && (
            <div className="sm:col-span-2">
              <Label>Printer from inventory *</Label>
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

          {source === "HISTORY" && (
            <div className="sm:col-span-2">
              <Label>Previous device *</Label>
              <Select
                value={historyRepairId}
                onChange={(e) => setHistoryRepairId(e.target.value)}
                className="mt-1"
                required
              >
                <option value="">Select from repair history</option>
                {options.deviceHistory.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.label}
                    {h.repairCount > 1 ? ` (${h.repairCount} repairs)` : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label>Client (optional)</Label>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)} className="mt-1" disabled={source === "RENTAL"}>
              <option value="">Walk-in / none</option>
              {options.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Customer name {source === "WALK_IN" && !clientId ? "*" : ""}</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Owner / walk-in name"
              className="mt-1"
              required={source === "WALK_IN" && !clientId}
              disabled={source === "RENTAL"}
            />
          </div>

          {(source === "WALK_IN" || source === "HISTORY") && (
            <>
              <div>
                <Label>Brand</Label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Model</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1" />
              </div>
              <div className="sm:col-span-2">
                <Label>Serial number</Label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="mt-1" />
              </div>
            </>
          )}

          <div className="sm:col-span-2">
            <Label>Problem *</Label>
            <Input name="problem" required placeholder="Reported issue" className="mt-1" />
          </div>
          <div className="sm:col-span-2">
            <Label>Diagnosis</Label>
            <Input name="diagnosis" placeholder="Technician findings" className="mt-1" />
          </div>

          <div>
            <Label>Status *</Label>
            <Select name="status" defaultValue="PENDING" className="mt-1" required>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
          <div>
            <Label>Repair price (PHP)</Label>
            <Input
              name="totalAmount"
              type="number"
              step="0.01"
              min="0"
              value={chargeWaived || autoWaive ? "0" : totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              disabled={chargeWaived || autoWaive}
              className="mt-1"
            />
            {(chargeWaived || autoWaive) && (
              <p className="mt-1 text-xs text-emerald-700">No charge — rental unit</p>
            )}
            {source !== "RENTAL" && !autoWaive && (
              <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={chargeWaived}
                  onChange={(e) => {
                    setChargeWaived(e.target.checked);
                    if (e.target.checked) setTotalAmount("0");
                  }}
                />
                Waive charge (goodwill / warranty)
              </label>
            )}
          </div>

          <div>
            <Label>Date received *</Label>
            <Input name="receivedAt" type="date" required defaultValue={todayInput()} className="mt-1" />
          </div>
          <div>
            <Label>Date returned / completed</Label>
            <Input name="completedAt" type="date" className="mt-1" />
          </div>

          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Internal notes" className="mt-1" />
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Accept repair"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
