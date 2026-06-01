import Link from "next/link";
import {
  isBillingMonthDue,
  isBillingMonthSettled,
  MONTH_LABELS,
  monthlyPaymentDueDate,
  type ClientAnnualRow,
} from "@/lib/rental-annual";
import { formatCurrency } from "@/lib/utils";

function monthCellTitle(
  cell: ClientAnnualRow["months"][0],
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

function monthCellClass(cell: ClientAnnualRow["months"][0]) {
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
  return "bg-slate-50 text-slate-400";
}

function monthCellLabel(cell: ClientAnnualRow["months"][0]) {
  if (isBillingMonthSettled(cell)) return "Paid";
  if (isBillingMonthDue(cell)) return "Due";
  if (cell.state === "running") return "Running";
  if (cell.state === "paused") return "Pause";
  if (cell.state === "stopped") return "Stop";
  return "—";
}

export function PortalClientBillingGrid({
  row,
  year,
  startDate,
}: {
  row: ClientAnnualRow;
  year: number;
  /** Earliest rental start (for due dates). */
  startDate: Date;
}) {
  const overdueMonths = row.months.filter((c) => isBillingMonthDue(c));
  const overdueTotal = overdueMonths.reduce((s, c) => s + (c.expected ?? 0), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="font-medium text-slate-700">
          {year} — {row.unitCount} {row.unitCount === 1 ? "unit" : "units"}
        </p>
        {overdueTotal > 0 ? (
          <p className="text-red-700">
            <span className="font-semibold">{formatCurrency(overdueTotal)}</span> overdue
            {overdueMonths.length > 0 && (
              <span className="text-red-600/80"> ({overdueMonths.map((m) => m.label).join(", ")})</span>
            )}
          </p>
        ) : (
          <p className="font-medium text-emerald-700">No overdue months</p>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        A month shows <strong className="text-emerald-700">Paid</strong> once any payment is recorded
        for that month (net after VAT is fine). <strong className="text-red-600">Due</strong> only
        when nothing has been paid yet.
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">
        {row.months.map((cell) => (
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
      <p className="mt-3 text-xs text-slate-500">
        <Link href="/portal/rentals" className="font-medium text-brand-600 hover:underline">
          View each printer
        </Link>{" "}
        for payment history.
      </p>
    </div>
  );
}
