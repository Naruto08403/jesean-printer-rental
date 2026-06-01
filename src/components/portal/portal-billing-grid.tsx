import {
  isBillingMonthDue,
  isBillingMonthSettled,
  MONTH_LABELS,
  monthlyPaymentDueDate,
} from "@/lib/rental-annual";
import { balanceFromAnnualRow } from "@/lib/portal-rental-balance";
import type { RentalAnnualRow } from "@/lib/rental-annual";
import { formatCurrency } from "@/lib/utils";
import type { MonthCell } from "@/lib/rental-annual";
import type { RentalStatus } from "@prisma/client";

function monthCellClass(cell: MonthCell) {
  if (isBillingMonthSettled(cell)) {
    return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100";
  }
  if (isBillingMonthDue(cell)) {
    return "bg-red-50 text-red-700 ring-1 ring-red-100";
  }
  if (cell.state === "running") {
    return "bg-brand-50 text-brand-700 ring-1 ring-brand-100";
  }
  if (cell.state === "paused") {
    return "bg-amber-50/60 text-amber-600 ring-1 ring-amber-100";
  }
  if (cell.state === "stopped") {
    return "bg-slate-100 text-slate-500 ring-1 ring-slate-200";
  }
  if (cell.state === "out") {
    return "bg-slate-50 text-slate-300";
  }
  return "bg-slate-50 text-slate-400";
}

function monthCellLabel(cell: MonthCell) {
  if (isBillingMonthSettled(cell)) return "Paid";
  if (isBillingMonthDue(cell)) return "Due";
  if (cell.state === "running") return "Running";
  if (cell.state === "paused") return "Pause";
  if (cell.state === "stopped") return "Stop";
  if (cell.state === "out") return "—";
  return "·";
}

function monthCellTitle(
  cell: MonthCell,
  year: number,
  startDate: Date
) {
  if (isBillingMonthSettled(cell)) {
    return `${cell.label}: Paid ${formatCurrency(cell.paid)}`;
  }
  if (isBillingMonthDue(cell) && cell.expected != null) {
    const due = monthlyPaymentDueDate(startDate, year, cell.month);
    return `${cell.label}: ${formatCurrency(cell.expected)} due · pay by ${due.toLocaleDateString()}`;
  }
  if (cell.state === "running") {
    return `${cell.label}: Not due yet`;
  }
  return cell.label;
}

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
            {balance.overdueMonths.length > 0 && (
              <span className="text-red-600/80"> ({balance.overdueMonths.join(", ")})</span>
            )}
          </p>
        ) : balance.label === "paused" ? (
          <p className="text-amber-700">Paused — no balance due</p>
        ) : (
          <p className="font-medium text-emerald-700">No overdue months</p>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        <strong className="text-emerald-700">Paid</strong> = payment recorded for that month (net
        after VAT is OK). <strong className="text-red-600">Due</strong> = no payment yet.
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {annualRow.months.map((cell) => (
          <div
            key={cell.month}
            className={`rounded-xl px-1 py-2 text-center ${monthCellClass(cell)}`}
            title={monthCellTitle(cell, year, startDate)}
          >
            <p className="text-[10px] font-medium uppercase tracking-wide opacity-70">
              {MONTH_LABELS[cell.month]}
            </p>
            <p className="mt-0.5 text-xs font-semibold">{monthCellLabel(cell)}</p>
            {isBillingMonthSettled(cell) && cell.paid > 0 && (
              <p className="mt-0.5 truncate text-[10px] opacity-80">{formatCurrency(cell.paid)}</p>
            )}
            {isBillingMonthDue(cell) && cell.expected != null && (
              <p className="mt-0.5 truncate text-[10px] opacity-80">{formatCurrency(cell.expected)}</p>
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-brand-100 ring-1 ring-brand-200" /> Running
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-emerald-100 ring-1 ring-emerald-200" /> Paid
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-red-100 ring-1 ring-red-200" /> Due
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded bg-amber-100 ring-1 ring-amber-200" /> Paused
        </span>
      </div>
    </div>
  );
}
