"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { addBulkRentalPayments } from "@/actions/payments";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  DEFAULT_RENTAL_VAT_PERCENT,
  defaultRentalAnnualYear,
  MONTH_LABELS,
  netPayableAfterVat,
  rentalAnnualYearOptions,
} from "@/lib/rental-annual";

type ClientOption = {
  id: string;
  label: string;
  monthlyPayable: number;
  suggestedAmount: number;
  unitCount: number;
};

function formatAmount(value: number) {
  if (!value) return "";
  return String(Math.round(value * 100) / 100);
}

function todayDateInput() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function AddRentalPaymentModal({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [amount, setAmount] = useState("");
  const [vatPercent, setVatPercent] = useState(String(DEFAULT_RENTAL_VAT_PERCENT));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const years = rentalAnnualYearOptions();
  const defaultYear = defaultRentalAnnualYear();
  const currentMonth = new Date().getMonth();

  const selected = clients.find((c) => c.id === clientId);

  const vat = Number(vatPercent) || 0;
  const grossPayable = selected?.monthlyPayable ?? 0;
  const vatAmount =
    grossPayable > 0 && vat > 0 ? Math.round(grossPayable * (vat / 100) * 100) / 100 : 0;
  const netPayable = grossPayable > 0 ? netPayableAfterVat(grossPayable, vat) : 0;

  useEffect(() => {
    if (!selected) {
      setAmount("");
      return;
    }
    setAmount(formatAmount(netPayableAfterVat(selected.monthlyPayable, Number(vatPercent) || 0)));
  }, [selected, vatPercent]);

  function resetForm() {
    setClientId("");
    setAmount("");
    setVatPercent(String(DEFAULT_RENTAL_VAT_PERCENT));
    setError(null);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <Banknote className="h-4 w-4" />
        Add payment
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Record rental payments"
        className="max-w-xl"
      >
        <p className="mb-4 text-sm text-slate-600">
          Net amount is computed from contract payable minus VAT. You can pay the current month
          even before it shows as due on the grid. Any payment for a month marks it settled (net
          after VAT is OK). Payment date is when the transaction was received. Month range
          controls which billing months receive entries.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
              setError(null);
              try {
                await addBulkRentalPayments(fd);
                setOpen(false);
                resetForm();
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to save payments");
              }
            })
          }
        >
          <div className="sm:col-span-2">
            <Label>Client *</Label>
            <Select
              name="clientId"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                  {c.monthlyPayable > 0
                    ? ` · ${formatCurrency(c.monthlyPayable)}/mo`
                    : ""}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>VAT withheld (%)</Label>
            <Input
              name="vatPercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={vatPercent}
              onChange={(e) => setVatPercent(e.target.value)}
              placeholder={String(DEFAULT_RENTAL_VAT_PERCENT)}
            />
          </div>
          <div>
            <Label>Amount per month — net (PHP) *</Label>
            <Input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="After VAT"
            />
          </div>
          {selected && grossPayable > 0 && (
            <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              <p>
                Gross payable: <strong>{formatCurrency(grossPayable)}</strong>/mo
                {selected.unitCount > 1 ? ` · ${selected.unitCount} units` : ""}
              </p>
              {vat > 0 && (
                <p className="mt-1 text-slate-600">
                  VAT ({vat}%): −{formatCurrency(vatAmount)} → Net payment:{" "}
                  <strong>{formatCurrency(netPayable)}</strong>/mo
                </p>
              )}
            </div>
          )}
          <div>
            <Label>Payment date *</Label>
            <Input
              name="recordDate"
              type="date"
              required
              defaultValue={todayDateInput()}
            />
          </div>
          <div>
            <Label>Year *</Label>
            <Select name="year" defaultValue={String(defaultYear)} required>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>From month *</Label>
            <Select name="startMonth" defaultValue={String(currentMonth)} required>
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>To month *</Label>
            <Select name="endMonth" defaultValue={String(currentMonth)} required>
              {MONTH_LABELS.map((label, i) => (
                <option key={label} value={i}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Method</Label>
            <Input name="method" placeholder="Cash, GCash, Bank..." />
          </div>
          <div>
            <Label>Reference</Label>
            <Input name="reference" placeholder="Receipt / ref #" />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Input name="notes" placeholder="Optional note for all payments" />
          </div>
          {error && (
            <p className="text-sm text-red-600 sm:col-span-2" role="alert">
              {error}
            </p>
          )}
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
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save payments"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
