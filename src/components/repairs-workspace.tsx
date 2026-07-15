"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { RepairPaymentOption } from "@/actions/payments";
import type { getRepairFormOptions } from "@/actions/repairs";
import {
  AddRepairPaymentModal,
  type RepairPaymentPreset,
} from "@/components/forms/add-repair-payment-modal";
import {
  RepairViewModal,
  type RepairDetailPayload,
} from "@/components/forms/repair-view-modal";
import { DeleteRepairButton } from "@/components/forms/delete-repair-button";
import { PaymentStatus } from "@/components/payment-status";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { DataTableElement } from "@/components/data-table";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { MONTH_LABELS } from "@/lib/rental-annual";
import type { PaymentSummary } from "@/lib/payments";

export type RepairPaymentFilter = "all" | "paid" | "unpaid" | "billed-unpaid";
export type RepairSortField = "received" | "customer" | "payment";
export type RepairSortDirection = "asc" | "desc";

export type RepairListRow = {
  id: string;
  clientKey: string;
  receivedAt: string;
  billingDate: string | null;
  customerLabel: string;
  printerLabel: string;
  serialNumber: string | null;
  amountLabel: string;
  isChargeWaived: boolean;
  paymentSummary: PaymentSummary;
  paymentCount: number;
  searchText: string;
  isUnpaid: boolean;
  isBillable: boolean;
  isPaid: boolean;
  isBilledUnpaid: boolean;
  filterYear: number;
  filterMonth: number;
};

function repairFilterDate(row: RepairListRow) {
  return {
    year: row.filterYear,
    month: row.filterMonth,
  };
}

function matchesPaymentFilter(row: RepairListRow, filter: RepairPaymentFilter) {
  switch (filter) {
    case "paid":
      return row.isBillable && row.isPaid;
    case "unpaid":
      return row.isBillable && row.isUnpaid;
    case "billed-unpaid":
      return row.isBilledUnpaid;
    default:
      return true;
  }
}

/** Lower rank = listed first when sorting payment ascending (unpaid first). */
function paymentSortRank(row: RepairListRow) {
  if (row.isChargeWaived || !row.isBillable) return 3;
  if (row.isUnpaid && row.paymentSummary.paid <= 0.001) return 0;
  if (row.isUnpaid) return 1;
  return 2;
}

function compareRepairs(
  a: RepairListRow,
  b: RepairListRow,
  field: RepairSortField,
  direction: RepairSortDirection
) {
  let cmp = 0;

  switch (field) {
    case "customer":
      cmp = a.customerLabel.localeCompare(b.customerLabel, undefined, { sensitivity: "base" });
      break;
    case "payment":
      cmp = paymentSortRank(a) - paymentSortRank(b);
      if (cmp === 0) {
        cmp = b.paymentSummary.balance - a.paymentSummary.balance;
      }
      break;
    default:
      cmp = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
      break;
  }

  if (cmp === 0) {
    cmp = a.customerLabel.localeCompare(b.customerLabel, undefined, { sensitivity: "base" });
  }

  return direction === "asc" ? cmp : -cmp;
}

function sortFieldLabel(field: RepairSortField) {
  switch (field) {
    case "customer":
      return "Customer";
    case "payment":
      return "Payment";
    default:
      return "Date received";
  }
}

type FormOptions = Awaited<ReturnType<typeof getRepairFormOptions>>;

function SummaryTile({
  label,
  value,
  hint,
  active,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl border bg-white px-4 py-3 text-left shadow-sm transition",
        onClick && "cursor-pointer hover:border-brand-200 hover:shadow-md",
        active ? "border-brand-300 ring-2 ring-brand-100" : "border-slate-200"
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </Tag>
  );
}

export function RepairsWorkspace({
  rows,
  paymentOptions,
  formOptions,
  repairDetails,
}: {
  rows: RepairListRow[];
  paymentOptions: RepairPaymentOption[];
  formOptions: FormOptions;
  repairDetails: Record<string, RepairDetailPayload>;
}) {
  const [query, setQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<RepairPaymentFilter>("all");
  const [yearFilter, setYearFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<RepairSortField>("received");
  const [sortDirection, setSortDirection] = useState<RepairSortDirection>("desc");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [untouchedOnly, setUntouchedOnly] = useState(false);
  const [paymentPreset, setPaymentPreset] = useState<RepairPaymentPreset | null>(null);
  const [viewRepairId, setViewRepairId] = useState<string | null>(null);

  const viewRepair = viewRepairId ? repairDetails[viewRepairId] ?? null : null;

  const availableYears = useMemo(() => {
    const years = new Set(rows.map((row) => row.filterYear));
    return [...years].sort((a, b) => b - a);
  }, [rows]);

  const stats = useMemo(() => {
    const billable = rows.filter((r) => r.isBillable);
    const unpaidRows = billable.filter((r) => r.isUnpaid);
    const billedUnpaidRows = rows.filter((r) => r.isBilledUnpaid);
    return {
      totalRecords: rows.length,
      totalAmount: billable.reduce((s, r) => s + r.paymentSummary.total, 0),
      totalUnpaid: unpaidRows.reduce((s, r) => s + r.paymentSummary.balance, 0),
      unpaidCount: unpaidRows.length,
      billedUnpaidCount: billedUnpaidRows.length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const year = yearFilter === "all" ? null : Number(yearFilter);
    const month = monthFilter === "all" ? null : Number(monthFilter);

    return rows.filter((row) => {
      if (!matchesPaymentFilter(row, paymentFilter)) return false;

      const { year: rowYear, month: rowMonth } = repairFilterDate(row);
      if (year != null && rowYear !== year) return false;
      if (month != null && rowMonth !== month) return false;

      if (!q) return true;
      return row.searchText.toLowerCase().includes(q);
    });
  }, [rows, query, paymentFilter, yearFilter, monthFilter]);

  const sortedRows = useMemo(() => {
    return [...filtered].sort((a, b) => compareRepairs(a, b, sortField, sortDirection));
  }, [filtered, sortField, sortDirection]);

  const hasActiveFilters =
    paymentFilter !== "all" ||
    yearFilter !== "all" ||
    monthFilter !== "all" ||
    query.trim().length > 0 ||
    sortField !== "received" ||
    sortDirection !== "desc";

  function clearFilters() {
    setPaymentFilter("all");
    setYearFilter("all");
    setMonthFilter("all");
    setSortField("received");
    setSortDirection("desc");
    setQuery("");
  }

  function paymentFilterLabel(filter: RepairPaymentFilter) {
    switch (filter) {
      case "paid":
        return "Paid";
      case "unpaid":
        return "Unpaid";
      case "billed-unpaid":
        return "Billed unpaid";
      default:
        return "All";
    }
  }

  function openPaymentForRow(row: RepairListRow) {
    setPaymentPreset({ clientKey: row.clientKey });
    setPaymentOpen(true);
  }

  return (
    <div className="space-y-4">
      <AddRepairPaymentModal
        repairs={paymentOptions}
        showTrigger={false}
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        preset={paymentPreset}
      />

      <RepairViewModal
        repair={viewRepair}
        options={formOptions}
        open={viewRepairId != null}
        onClose={() => setViewRepairId(null)}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Records" value={String(stats.totalRecords)} hint="All repair jobs" />
        <SummaryTile
          label="Total amount"
          value={formatCurrency(stats.totalAmount)}
          hint="Billable jobs only"
        />
        <SummaryTile
          label="Total unpaid"
          value={formatCurrency(stats.totalUnpaid)}
          hint={
            stats.unpaidCount > 0
              ? `${stats.unpaidCount} job${stats.unpaidCount === 1 ? "" : "s"} · click to filter`
              : "All paid"
          }
          active={paymentFilter === "unpaid"}
          onClick={stats.unpaidCount > 0 ? () => setPaymentFilter("unpaid") : undefined}
        />
        <SummaryTile
          label="Billed unpaid"
          value={String(stats.billedUnpaidCount)}
          hint={
            stats.billedUnpaidCount > 0
              ? "Has billing date · click to filter"
              : "None outstanding"
          }
          active={paymentFilter === "billed-unpaid"}
          onClick={
            stats.billedUnpaidCount > 0
              ? () => setPaymentFilter("billed-unpaid")
              : undefined
          }
        />
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div>
          <Label htmlFor="repair-payment-filter">Payment</Label>
          <Select
            id="repair-payment-filter"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as RepairPaymentFilter)}
            className="mt-1"
          >
            <option value="all">All</option>
            <option value="paid">Paid</option>
            <option value="unpaid">Unpaid</option>
            <option value="billed-unpaid">Billed unpaid</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="repair-year-filter">Year</Label>
          <Select
            id="repair-year-filter"
            value={yearFilter}
            onChange={(e) => setYearFilter(e.target.value)}
            className="mt-1"
          >
            <option value="all">All years</option>
            {availableYears.map((year) => (
              <option key={year} value={String(year)}>
                {year}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="repair-month-filter">Month</Label>
          <Select
            id="repair-month-filter"
            value={monthFilter}
            onChange={(e) => setMonthFilter(e.target.value)}
            className="mt-1"
          >
            <option value="all">All months</option>
            {MONTH_LABELS.map((label, index) => (
              <option key={label} value={String(index + 1)}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="repair-sort-field">Sort by</Label>
          <Select
            id="repair-sort-field"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as RepairSortField)}
            className="mt-1"
          >
            <option value="received">Date received</option>
            <option value="customer">Customer</option>
            <option value="payment">Payment</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="repair-sort-direction">Order</Label>
          <Select
            id="repair-sort-direction"
            value={sortDirection}
            onChange={(e) => setSortDirection(e.target.value as RepairSortDirection)}
            className="mt-1"
          >
            <option value="asc">
              {sortField === "received"
                ? "Oldest first"
                : sortField === "customer"
                  ? "A → Z"
                  : "Unpaid first"}
            </option>
            <option value="desc">
              {sortField === "received"
                ? "Newest first"
                : sortField === "customer"
                  ? "Z → A"
                  : "Paid first"}
            </option>
          </Select>
        </div>
        <div className="flex items-end">
          <p className="text-xs text-slate-500">
            Year/month use billing date when set, else date received. Payment sort: unpaid →
            partial → paid.
          </p>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-900">
          <span>
            Showing <strong>{sortedRows.length}</strong> of {rows.length} repair
            {rows.length === 1 ? "" : "s"}
            {paymentFilter !== "all" && (
              <>
                {" "}
                · Payment: <strong>{paymentFilterLabel(paymentFilter)}</strong>
              </>
            )}
            {yearFilter !== "all" && (
              <>
                {" "}
                · Year: <strong>{yearFilter}</strong>
              </>
            )}
            {monthFilter !== "all" && (
              <>
                {" "}
                · Month: <strong>{MONTH_LABELS[Number(monthFilter) - 1]}</strong>
              </>
            )}
            {(sortField !== "received" || sortDirection !== "desc") && (
              <>
                {" "}
                · Sort: <strong>{sortFieldLabel(sortField)}</strong> (
                {sortDirection === "asc" ? "asc" : "desc"})
              </>
            )}
            {query.trim() && (
              <>
                {" "}
                · Search: <strong>{query.trim()}</strong>
              </>
            )}
          </span>
          <button
            type="button"
            onClick={clearFilters}
            className="font-medium text-brand-700 hover:underline"
          >
            Clear filters
          </button>
        </div>
      )}

      {paymentFilter === "billed-unpaid" && stats.billedUnpaidCount === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          No billed-but-unpaid repairs right now.
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by customer, printer, serial number, brand, model…"
          className="pr-9 pl-9"
          aria-label="Search repairs"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <DataTableElement>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Printer</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Payment</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No repairs yet.
                  </td>
                </tr>
              )}
              {rows.length > 0 && sortedRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No results match your filters{query ? " or search" : ""}.
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                  <td className="px-4 py-3 text-slate-600">{formatDate(row.receivedAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{row.customerLabel}</td>
                  <td className="px-4 py-3 text-slate-600">
                    <div>{row.printerLabel}</div>
                    {row.serialNumber && (
                      <div className="text-xs text-slate-400">SN: {row.serialNumber}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.amountLabel}</td>
                  <td className="px-4 py-3">
                    {row.isChargeWaived ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <PaymentStatus
                        summary={row.paymentSummary}
                        billing={row.billingDate}
                        onPayClick={
                          row.isUnpaid ? () => openPaymentForRow(row) : undefined
                        }
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setViewRepairId(row.id)}
                        className="text-brand-600 hover:underline"
                      >
                        View
                      </button>
                      <DeleteRepairButton
                        repairId={row.id}
                        label="Delete"
                        paymentCount={row.paymentCount}
                        variant="ghost"
                        className="px-2 py-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTableElement>
        </div>
      </Card>
    </div>
  );
}
