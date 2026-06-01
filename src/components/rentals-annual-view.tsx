"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { GenerateBillingModal } from "@/components/forms/generate-billing-modal";
import { formatCurrency } from "@/lib/utils";
import {
  buildClientAnnualRows,
  buildRentalAnnualRow,
  defaultRentalAnnualYear,
  isFutureMonth,
  MONTH_LABELS,
  rentalAnnualYearOptions,
  type RentalAnnualRow,
} from "@/lib/rental-annual";
import type { ClientStatus, PaymentSchedule, RentalStatus } from "@prisma/client";

type RentalInput = {
  id: string;
  status: RentalStatus;
  startDate: string;
  endDate: string | null;
  ratePerPeriod: number;
  paymentSchedule: PaymentSchedule;
  client: { id: string; name: string; status: ClientStatus };
  printer:
    | { brand: string | null; model: string | null; serialNumber: string | null; price?: number | null }
    | null;
  pausePeriods?: { pausedAt: string; resumedAt: string | null }[];
  payments: { amount: number; paidAt: string }[];
};

function toRentalLike(r: RentalInput) {
  return {
    ...r,
    startDate: new Date(r.startDate),
    endDate: r.endDate ? new Date(r.endDate) : null,
    pausePeriods: (r.pausePeriods ?? []).map((p) => ({
      pausedAt: new Date(p.pausedAt),
      resumedAt: p.resumedAt ? new Date(p.resumedAt) : null,
    })),
    payments: r.payments.map((p) => ({
      amount: p.amount,
      paidAt: new Date(p.paidAt),
    })),
  };
}

function paidAmountClass(cell: RentalAnnualRow["months"][0]) {
  if (cell.state === "partial" || (cell.expected != null && cell.paid > 0 && cell.paid < cell.expected - 0.01)) {
    return "font-medium text-orange-600";
  }
  return "font-medium text-emerald-700";
}

function MonthCellView({
  cell,
  year,
}: {
  cell: RentalAnnualRow["months"][0];
  year: number;
}) {
  if (cell.state === "out") {
    return <span className="text-slate-300">—</span>;
  }
  if (isFutureMonth(year, cell.month)) {
    return <span className="text-slate-300">—</span>;
  }
  if (cell.state === "paused") {
    return (
      <span className="text-xs text-amber-600" title="Paused">
        {cell.paid > 0 ? (
          <span className={paidAmountClass(cell)} title="Payment recorded">
            {formatCurrency(cell.paid)}
          </span>
        ) : (
          "pause"
        )}
      </span>
    );
  }
  if (cell.state === "stopped") {
    return (
      <span className="text-xs font-medium text-amber-700" title="Client stopped — no billing">
        {cell.paid > 0 ? (
          <span className={paidAmountClass(cell)}>{formatCurrency(cell.paid)}</span>
        ) : (
          "stop"
        )}
      </span>
    );
  }
  if (cell.state === "running") {
    return (
      <span className="text-xs font-medium text-brand-600" title="Active — not due yet">
        {cell.paid > 0 ? (
          <span className={paidAmountClass(cell)}>{formatCurrency(cell.paid)}</span>
        ) : (
          "run"
        )}
      </span>
    );
  }
  if (cell.state === "partial" && cell.paid > 0) {
    return (
      <span
        className="font-medium text-orange-600"
        title={
          cell.expected != null
            ? `Partial — expected ${formatCurrency(cell.expected)}`
            : "Partial payment"
        }
      >
        {formatCurrency(cell.paid)}
      </span>
    );
  }
  if (cell.paid > 0) {
    return (
      <span className="font-medium text-emerald-700" title="Paid in full">
        {formatCurrency(cell.paid)}
      </span>
    );
  }
  if (cell.state === "expected" && cell.expected != null) {
    return (
      <span className="font-medium text-red-600">{formatCurrency(cell.expected)}</span>
    );
  }
  if (cell.expected != null) {
    return <span className="text-slate-400">{formatCurrency(cell.expected)}</span>;
  }
  return <span className="text-slate-300">—</span>;
}

const statusColor: Record<string, "green" | "amber" | "slate" | "red"> = {
  ACTIVE: "green",
  PAUSED: "amber",
  STOPPED: "amber",
  COMPLETED: "slate",
  CANCELLED: "red",
};

export function RentalsAnnualView({
  rentals,
  billingClients = [],
}: {
  rentals: RentalInput[];
  billingClients?: {
    id: string;
    label: string;
    monthlyPayable: number;
    unitCount: number;
  }[];
}) {
  const years = rentalAnnualYearOptions();
  const [year, setYear] = useState(defaultRentalAnnualYear());
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () => buildClientAnnualRows(rentals.map(toRentalLike), year),
    [rentals, year]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.clientName.toLowerCase().includes(q) ||
        String(r.unitCount).includes(q) ||
        r.status.toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totals = useMemo(() => {
    const monthPaid = Array.from({ length: 12 }, () => 0);
    let totalUnits = 0;
    let yearPaid = 0;

    for (const row of filtered) {
      totalUnits += row.unitCount;
      yearPaid += row.yearPaid;
      row.months.forEach((cell, i) => {
        monthPaid[i] += cell.paid;
      });
    }

    return { totalUnits, monthPaid, yearPaid };
  }, [filtered]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="rental-year" className="text-sm font-medium text-slate-700">
              Year
            </label>
            <Select
              id="rental-year"
              value={String(year)}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-28"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="search"
              placeholder="Search client..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Auto-renew · <span className="text-emerald-700">paid</span> ·{" "}
          <span className="text-orange-600">partial</span> ·{" "}
          <span className="text-red-600">overdue</span> ·{" "}
          <span className="text-amber-700">stop/pause</span> · future hidden
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[1100px] w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="sticky left-0 z-10 bg-slate-50/95 px-3 py-2.5 font-medium">
                Client
              </th>
              <th className="px-2 py-2.5 font-medium">Units</th>
              {MONTH_LABELS.map((label) => (
                <th key={label} className="px-2 py-2.5 text-center font-medium">
                  {label}
                </th>
              ))}
              <th className="px-2 py-2.5 font-medium text-right">Total</th>
              <th className="px-2 py-2.5 font-medium">Status</th>
              <th className="px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={17} className="px-4 py-8 text-center text-slate-500">
                  {rows.length === 0 ? "No rentals yet." : "No matches for your search."}
                </td>
              </tr>
            )}
            {filtered.map((row) => (
              <tr key={row.clientId} className="border-b border-slate-50 hover:bg-slate-50/50">
                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium">
                  {row.clientName}
                </td>
                <td className="px-2 py-2 text-slate-600">
                  {row.unitCount} {row.unitCount === 1 ? "unit" : "units"}
                </td>
                {row.months.map((cell) => (
                  <td key={cell.month} className="px-2 py-2 text-center">
                    <MonthCellView cell={cell} year={year} />
                  </td>
                ))}
                <td className="px-2 py-2 text-right">
                  {row.yearPaid > 0 ? (
                    <span className="font-semibold text-emerald-700">
                      {formatCurrency(row.yearPaid)}
                    </span>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Badge color={statusColor[row.status] ?? "slate"}>
                    {row.status === "STOPPED"
                      ? "Stop"
                      : row.status.replace("_", " ")}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {billingClients.length > 0 && (
                      <GenerateBillingModal
                        clients={billingClients}
                        defaultClientId={row.clientId}
                        triggerLabel="Billing"
                        triggerVariant="ghost"
                      />
                    )}
                    <Link
                      href={`/dashboard/clients/${row.clientId}`}
                      className="text-brand-600 hover:underline"
                    >
                      View
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50/90 font-semibold text-slate-800">
                <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5">Total</td>
                <td className="px-2 py-2.5">
                  {totals.totalUnits} {totals.totalUnits === 1 ? "unit" : "units"}
                </td>
                {totals.monthPaid.map((paid, i) => (
                  <td key={i} className="px-2 py-2.5 text-center">
                    {paid > 0 && !isFutureMonth(year, i) ? (
                      <span className="text-emerald-800">{formatCurrency(paid)}</span>
                    ) : (
                      <span className="font-normal text-slate-300">—</span>
                    )}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-right">
                  {totals.yearPaid > 0 ? (
                    <span className="text-emerald-800">{formatCurrency(totals.yearPaid)}</span>
                  ) : (
                    <span className="font-normal text-slate-300">—</span>
                  )}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

export function RentalAnnualPayments({
  rental,
  initialYear,
}: {
  rental: RentalInput;
  initialYear?: number;
}) {
  const years = rentalAnnualYearOptions();
  const [year, setYear] = useState(initialYear ?? defaultRentalAnnualYear());

  const row = useMemo(
    () => buildRentalAnnualRow(toRentalLike(rental), year),
    [rental, year]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <label htmlFor="detail-year" className="text-sm font-medium text-slate-700">
            Year
          </label>
          <Select
            id="detail-year"
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
            className="w-28"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-sm text-slate-600">
          Received {formatCurrency(row.yearPaid)} in {year}
        </p>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {row.months.map((cell) => (
          <div
            key={cell.month}
            className="rounded-lg border border-slate-100 bg-slate-50/50 px-2 py-2 text-center"
          >
            <p className="text-xs font-medium text-slate-500">{cell.label}</p>
            <div className="mt-1 text-sm">
              <MonthCellView cell={cell} year={year} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
