"use client";

import { useEffect, useState, useTransition } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import {
  defaultRentalAnnualYear,
  MONTH_LABELS,
  rentalAnnualYearOptions,
} from "@/lib/rental-annual";
import { formatMonthsCoveredLabel } from "@/lib/rental-billing-excel";

type ClientOption = {
  id: string;
  label: string;
  monthlyPayable: number;
  unitCount: number;
};

function todayDateInput() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function GenerateBillingModal({
  clients,
  defaultClientId,
  triggerLabel = "Generate billing",
  triggerVariant = "secondary",
}: {
  clients: ClientOption[];
  defaultClientId?: string;
  triggerLabel?: string;
  triggerVariant?: "secondary" | "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [year, setYear] = useState(String(defaultRentalAnnualYear()));
  const [startMonth, setStartMonth] = useState("3");
  const [endMonth, setEndMonth] = useState("4");
  const [issueDate, setIssueDate] = useState(todayDateInput());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const years = rentalAnnualYearOptions();
  const selected = clients.find((c) => c.id === clientId);

  useEffect(() => {
    if (defaultClientId) setClientId(defaultClientId);
  }, [defaultClientId]);

  function resetForm() {
    setError(null);
    setIssueDate(todayDateInput());
    if (!defaultClientId) setClientId("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!clientId) {
      setError("Select a client.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/billing/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            year: Number(year),
            startMonth: Number(startMonth),
            endMonth: Number(endMonth),
            issueDate,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to generate billing");
        }

        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        const match = disposition?.match(/filename="([^"]+)"/);
        const filename = match?.[1] ?? "billing.xlsx";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setOpen(false);
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate billing");
      }
    });
  }

  const previewMonths =
    clientId && startMonth && endMonth
      ? formatMonthsCoveredLabel(Number(year), Number(startMonth), Number(endMonth))
      : null;

  return (
    <>
      <Button
        type="button"
        variant={triggerVariant}
        onClick={() => {
          if (defaultClientId) setClientId(defaultClientId);
          setOpen(true);
        }}
      >
        <FileSpreadsheet className="h-4 w-4" />
        {triggerLabel}
      </Button>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Generate billing statement"
        className="max-w-lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-slate-500">
            Downloads an Excel file with <strong>two copies</strong> of the billing statement on one
            page (from <code className="rounded bg-slate-100 px-1">templates/billing.xlsx</code>
            ), for all active units under the client.
          </p>

          <div>
            <Label htmlFor="billing-client">Client</Label>
            <Select
              id="billing-client"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="mt-1"
              disabled={Boolean(defaultClientId)}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>

          {selected && (
            <div className="rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2 text-sm text-brand-900">
              <strong>{selected.unitCount}</strong> active unit{selected.unitCount === 1 ? "" : "s"}{" "}
              · <strong>{formatCurrency(selected.monthlyPayable)}</strong> per month (all units)
            </div>
          )}

          <div>
            <Label htmlFor="billing-issue-date">Date issued</Label>
            <Input
              id="billing-issue-date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="mt-1"
              required
            />
          </div>

          <div>
            <Label htmlFor="billing-year">Billing year</Label>
            <Select
              id="billing-year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="mt-1"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="billing-from">Months covered — from</Label>
              <Select
                id="billing-from"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="mt-1"
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="billing-to">To</Label>
              <Select
                id="billing-to"
                value={endMonth}
                onChange={(e) => setEndMonth(e.target.value)}
                className="mt-1"
              >
                {MONTH_LABELS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {previewMonths && selected && (
            <p className="text-sm text-slate-600">
              Statement for <strong>{previewMonths}</strong> · total{" "}
              <strong>
                {formatCurrency(
                  selected.monthlyPayable * (Number(endMonth) - Number(startMonth) + 1)
                )}
              </strong>
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !clientId}>
              {pending ? "Generating…" : "Download Excel"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
