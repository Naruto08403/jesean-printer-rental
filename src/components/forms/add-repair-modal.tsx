"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, RefreshCw} from "lucide-react";
import { createRepair } from "@/actions/repairs";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { RepairPrinterSource, RepairPricingMode } from "@prisma/client";
import type { getRepairFormOptions } from "@/actions/repairs";
import { DiagnosisPicker, useDiagnosisSelection } from "@/components/forms/diagnosis-picker";
import { formatDiagnosisString } from "@/lib/repair-diagnosis-catalog";
import { formatCurrency } from "@/lib/utils";
import { PRINTER_MODELS } from "@/lib/printer_model";


type FormOptions = Awaited<ReturnType<typeof getRepairFormOptions>>;

function todayInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AddRepairModal({ options }: { options: FormOptions }) {
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
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
  const [problem, setProblem] = useState("");
  const [status, setStatus] = useState("PENDING");
  const [receivedAt, setReceivedAt] = useState(todayInput());
  const [billingDate, setBillingDate] = useState("");
  const [completedAt, setCompletedAt] = useState("");
  const [notes, setNotes] = useState("");
  const [chargeWaived, setChargeWaived] = useState(false);
  const [pricingMode, setPricingMode] = useState<RepairPricingMode>("CATALOG");
  const [generalPrice, setGeneralPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedPrinter = options.printers.find((p) => p.id === printerId);
  const selectedWalkInPrinter = options.walkInPrinters.find((p) => p.id === printerId);
  const selectedRental = options.rentalPrinters.find((r) => r.rentalId === rentalId);
  const selectedHistory = options.deviceHistory.find((h) => h.id === historyRepairId);
  const availableModels =
  PRINTER_MODELS[brand as keyof typeof PRINTER_MODELS] ?? [];
  
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

  const isWaived = chargeWaived || autoWaive;
  const { total: diagnosisTotal } = useDiagnosisSelection(
    options.diagnosisCatalog,
    selectedDiagnoses
  );
  const displayTotal =
    pricingMode === "GENERAL"
      ? Math.max(0, Number(generalPrice) || 0)
      : diagnosisTotal;
  const [refreshing, startRefresh] = useTransition();



  useEffect(() => {
    setChargeWaived(autoWaive);
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
    if (source === "WALK_IN") {
      setPrinterId("");
    }
  }, [clientId]);

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

  useEffect(() => {
    if (source !== "WALK_IN" || !selectedWalkInPrinter) return;
    setBrand(selectedWalkInPrinter.brand ?? "");
    setModel(selectedWalkInPrinter.model ?? "");
    setSerialNumber(selectedWalkInPrinter.serialNumber ?? "");
    if (selectedWalkInPrinter.ownerClientId) {
      setClientId(selectedWalkInPrinter.ownerClientId);
      setCustomerName(selectedWalkInPrinter.ownerLabel);
    }
  }, [source, selectedWalkInPrinter]);
  const filteredWalkInPrinters = useMemo(() => {
    if (!clientId) return [];
  
    return options.walkInPrinters.filter(
      (p) => p.ownerClientId === clientId
    );
  }, [clientId, options.walkInPrinters]);
  function handleSourceChange(next: RepairPrinterSource) {
    setSource(next);
    setPrinterId("");
    setRentalId("");
    setHistoryRepairId("");
    if (next !== "WALK_IN") {
      setBrand("");
      setModel("");
      setSerialNumber("");
    }
  }

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
    setProblem("");
    setStatus("PENDING");
    setReceivedAt(todayInput());
    setBillingDate("");
    setCompletedAt("");
    setNotes("");
    setSelectedDiagnoses([]);
    setChargeWaived(false);
    setPricingMode("CATALOG");
    setGeneralPrice("");
    setError(null);
    setSuccessMessage(null);
  }

  function buildSubmitFormData() {
    const fd = new FormData();
    fd.set("source", source);
    fd.set("clientId", clientId);
    fd.set("customerName", customerName);
    fd.set("printerId", printerId);
    fd.set("rentalId", rentalId);
    fd.set("historyRepairId", historyRepairId);
    fd.set("problem", problem.trim());
    fd.set("status", status);
    fd.set("receivedAt", receivedAt);
    if (completedAt) fd.set("completedAt", completedAt);
    if (billingDate) {
      fd.set("billingDate", billingDate);
    }
    if (notes.trim()) fd.set("notes", notes.trim());
    fd.set("diagnosis", formatDiagnosisString(selectedDiagnoses));
    fd.set("pricingMode", pricingMode);
    if (pricingMode === "GENERAL") {
      fd.set("generalPrice", generalPrice || "0");
    }
    if (isWaived) {
      fd.set("isChargeWaived", "true");
    }

    if (source === "INVENTORY" && printerId) {
      const p = options.printers.find((x) => x.id === printerId);
      if (p) {
        fd.set("brand", p.brand ?? "");
        fd.set("model", p.model ?? "");
        fd.set("serialNumber", p.serialNumber ?? "");
      }
    } else if (source === "WALK_IN" && printerId) {
      const p = options.walkInPrinters.find((x) => x.id === printerId);
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

    return fd;
  }
  function refreshDiagnoses() {
    startRefresh(() => {
      router.refresh();
    });
  }

  return (
    <>
      {pending && <LoadingOverlay message="Saving repair…" />}
      <Button type="button" onClick={() => { setOpen(true); setSuccessMessage(null); setError(null); }}>
        <Plus className="h-4 w-4" />
        Accept repair
      </Button>
      <Modal open={open} onClose={() => { setOpen(false); resetForm(); }} title="Accept printer for repair" className="max-w-2xl">
        <p className="mb-4 text-sm text-slate-600">
          Track rental units (no charge), inventory printers, walk-ins, and repeat devices from repair history.
        </p>
        {successMessage && (
          <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {successMessage}
          </p>
        )}
        {error && (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSuccessMessage(null);
            if (!problem.trim()) {
              setError("Problem description is required.");
              return;
            }
            if (!receivedAt) {
              setError("Date received is required.");
              return;
            }

            startTransition(async () => {
              try {
                await createRepair(buildSubmitFormData());
                resetForm();
                setSuccessMessage("Repair saved. You can accept another printer.");
                router.refresh();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to save repair");
              }
            });
          }}
        >
          <div className="sm:col-span-2">
            <Label>Printer source *</Label>
            <Select
              value={source}
              onChange={(e) => handleSourceChange(e.target.value as RepairPrinterSource)}
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
              <Label>Rental fleet printer *</Label>
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


{source === "WALK_IN" && clientId && (
  <div className="sm:col-span-2">
    <Label>Client Printer</Label>

    <Select
      value={printerId}
      onChange={(e) => setPrinterId(e.target.value)}
      className="mt-1"
    >
      <option value="">Register New Device</option>

      {filteredWalkInPrinters.map((p) => (
        <option key={p.id} value={p.id}>
          {[p.brand, p.model, p.serialNumber]
            .filter(Boolean)
            .join(" ")}
        </option>
      ))}
    </Select>

    {filteredWalkInPrinters.length === 0 && (
      <p className="mt-1 text-xs text-slate-500">
        This client has no registered printers.
      </p>
    )}

    <p className="mt-1 text-xs text-slate-500">
      Select an existing printer or leave it as <strong>Register New Device</strong>.
    </p>
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
            <Label>
              Client {source === "WALK_IN" && !printerId ? "*" : ""}
            </Label>
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1"
              disabled={source === "RENTAL" || (source === "WALK_IN" && Boolean(printerId))}
              required={source === "WALK_IN" && !printerId}
            >
              <option value="">Walk-in / none</option>
              {options.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Customer name {source === "WALK_IN" && !clientId && !printerId ? "*" : ""}</Label>
            <Input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Owner / walk-in name"
              className="mt-1"
              required={source === "WALK_IN" && !clientId && !printerId}
              disabled={source === "RENTAL" || (source === "WALK_IN" && Boolean(printerId))}
            />
          </div>

          {(source === "WALK_IN" && !printerId) || source === "HISTORY" ? (
            <>
              <div>
                <Label>Brand</Label>
                <Select
                  value={brand}
                  onChange={(e) => {
                    setBrand(e.target.value);
                    setModel("");
                  }}
                  className="mt-1"
                >
                  <option value="">Select Brand</option>

                  {Object.keys(PRINTER_MODELS).map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label>Model</Label>
                <Select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1"
                  disabled={!brand}
                >
                  <option value="">
                    {brand ? "Select Model" : "Select Brand First"}
                  </option>

                  {availableModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label>Serial number</Label>
                <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="mt-1" />
              </div>
            </>
          ) : null}

          <div className="sm:col-span-2">
            <Label>Problem *</Label>
            <Input
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              required
              placeholder="Reported issue"
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-2">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label>Diagnosis</Label>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={refreshDiagnoses}
                title="Refresh diagnosis list"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              <Link
                href="/dashboard/repairs/diagnoses"
                className="text-xs text-brand-600 hover:underline"
                target="_blank"
              >
                Manage prices
              </Link>
            </div>
          </div>
            <DiagnosisPicker
              catalog={options.diagnosisCatalog}
              selectedNames={selectedDiagnoses}
              onChange={setSelectedDiagnoses}
              disabled={false}
              showPrices={pricingMode === "CATALOG"}
            />
          </div>

          {!isWaived && (
            <div className="sm:col-span-2">
              <Label>Pricing</Label>
              <div className="mt-1 space-y-2 rounded-lg border border-slate-200 p-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={pricingMode === "CATALOG"}
                    onChange={() => setPricingMode("CATALOG")}
                  />
                  Use diagnosis price list (saved on this repair — later catalog changes won&apos;t affect it)
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="radio"
                    name="pricingMode"
                    checked={pricingMode === "GENERAL"}
                    onChange={() => setPricingMode("GENERAL")}
                  />
                  General price (select diagnoses, enter one total)
                </label>
              </div>
            </div>
          )}

          <div>
            <Label>Status *</Label>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1"
              required
            >
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
          </div>
          <div>
            <Label>Repair price (PHP)</Label>
            {pricingMode === "GENERAL" && !isWaived ? (
              <Input
                type="number"
                step="0.01"
                min="0"
                value={generalPrice}
                onChange={(e) => setGeneralPrice(e.target.value)}
                className="mt-1"
                placeholder="Enter total repair price"
              />
            ) : (
              <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                {isWaived ? (
                  <span className="font-medium text-emerald-700">No charge</span>
                ) : (
                  <span className="font-medium text-slate-900">{formatCurrency(displayTotal)}</span>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-500">
              {pricingMode === "GENERAL"
                ? "One total for all selected diagnoses."
                : "Calculated from diagnosis prices at save time."}
            </p>
            {isWaived && (
              <p className="mt-1 text-xs text-emerald-700">No charge — rental unit</p>
            )}
            {source !== "RENTAL" && !autoWaive && (
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
            <Label>Date received *</Label>
            <Input
              type="date"
              required
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Date returned / completed</Label>
            <Input
              type="date"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label>Billing Date</Label>
            <Input
              type="date"
              value={billingDate}
              onChange={(e) => setBillingDate(e.target.value)}
              className="mt-1"
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes"
              className="mt-1"
            />
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => { setOpen(false); resetForm(); }}>
              Cancel
            </Button>
            <Button type="submit" loading={pending}>
              {pending ? "Saving..." : "Accept repair"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
