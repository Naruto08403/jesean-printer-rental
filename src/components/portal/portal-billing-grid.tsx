import { MONTH_LABELS, monthlyPaymentDueDate } from "@/lib/rental-annual";
import { balanceFromAnnualRow } from "@/lib/portal-rental-balance";
import type { RentalAnnualRow } from "@/lib/rental-annual";
import { formatCurrency } from "@/lib/utils";
import type { MonthCell } from "@/lib/rental-annual";
import type { RentalStatus } from "@prisma/client";

const cellStyles: Record<MonthCell["state"], string> = {
  out: "bg-slate-50 text-slate-300",
  empty: "bg-slate-50 text-slate-400",
  running: "bg-brand-50 text-brand-700 ring-1 ring-brand-100",
  expected: "bg-red-50 text-red-700 ring-1 ring-red-100",
  paid: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  partial: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  paused: "bg-amber-50/60 text-amber-600 ring-1 ring-amber-100",
  stopped: "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
};

const cellLabel: Record<MonthCell["state"], string> = {
  out: "—",
  empty: "·",
  running: "Running",
  expected: "Due",
  paid: "Paid",
  partial: "Due",
  paused: "Pause",
  stopped: "Stop",
};

export function PortalBillingGrid({
  annualRow,
  rentalStatus,
  year,
  startDate,
}: {
  annualRow: RentalAnnualRow;
  rentalStatus: RentalStatus;
  year: number;
  startDate: Date;
}) {
  const balance = balanceFromAnnualRow(annualRow, rentalStatus);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-slate-700">{year} — monthly billing</p>
        {balance.label === "overdue" ? (
          <p className="text-red-700">
            <span className="font-semibold">{formatCurrency(balance.overdueBalance)}</span> overdue
          </p>
        ) : balance.label === "paused" ? (
          <p className="text-amber-700">Paused — no balance due</p>
        ) : (
          <p className="text-emerald-700 font-medium">Paid — no balance due</p>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Each month is billed separately. Running until the due date; due after that if unpaid.
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {annualRow.months.map((cell) => {
          const dueDate =
            cell.expected != null
              ? monthlyPaymentDueDate(startDate, year, cell.month)
              : null;
          return (
            <div
              key={cell.month}
              className={`rounded-xl px-1 py-2 text-center ${cellStyles[cell.state]}`}
              title={
                dueDate
                  ? `${cell.label}: ${formatCurrency(cell.paid)}${cell.expected != null ? ` / ${formatCurrency(cell.expected)}` : ""} · due ${dueDate.toLocaleDateString()}`
                  : cell.label
              }
            >
              <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">
                {MONTH_LABELS[cell.month]}
              </p>
              <p className="mt-0.5 text-xs font-semibold">{cellLabel[cell.state]}</p>
              {cell.paid > 0 && (
                <p className="mt-0.5 truncate text-[10px] opacity-80">{formatCurrency(cell.paid)}</p>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-brand-100 ring-1 ring-brand-200" /> Running
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-emerald-100 ring-1 ring-emerald-200" /> Paid
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-orange-100 ring-1 ring-orange-200" /> Partial
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-red-100 ring-1 ring-red-200" /> Overdue
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-amber-100 ring-1 ring-amber-200" /> Paused
        </span>
      </div>
    </div>
  );
}
