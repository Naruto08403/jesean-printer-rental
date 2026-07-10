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
import { DataTableElement } from "@/components/data-table";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import type { PaymentSummary } from "@/lib/payments";

export type RepairListRow = {
  id: string;
  clientKey: string;
  receivedAt: string;
  customerLabel: string;
  printerLabel: string;
  serialNumber: string | null;
  amountLabel: string;
  isChargeWaived: boolean;
  paymentSummary: PaymentSummary;
  paymentCount: number;
  searchText: string;
  isUnpaid: boolean;
};

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
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentPreset, setPaymentPreset] = useState<RepairPaymentPreset | null>(null);
  const [viewRepairId, setViewRepairId] = useState<string | null>(null);

  const viewRepair = viewRepairId ? repairDetails[viewRepairId] ?? null : null;

  const stats = useMemo(() => {
    const billable = rows.filter((r) => !r.isChargeWaived && r.paymentSummary.total > 0);
    const unpaidRows = billable.filter((r) => !r.paymentSummary.isFullyPaid);
    return {
      totalRecords: rows.length,
      totalAmount: billable.reduce((s, r) => s + r.paymentSummary.total, 0),
      totalUnpaid: unpaidRows.reduce((s, r) => s + r.paymentSummary.balance, 0),
      unpaidCount: unpaidRows.length,
    };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (unpaidOnly && !row.isUnpaid) return false;
      if (!q) return true;
      return row.searchText.toLowerCase().includes(q);
    });
  }, [rows, query, unpaidOnly]);

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

      <div className="grid gap-3 sm:grid-cols-3">
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
          active={unpaidOnly}
          onClick={stats.unpaidCount > 0 ? () => setUnpaidOnly((v) => !v) : undefined}
        />
      </div>

      {unpaidOnly && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span>
            Showing <strong>{stats.unpaidCount}</strong> unpaid job
            {stats.unpaidCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => setUnpaidOnly(false)}
            className="font-medium text-brand-600 hover:underline"
          >
            Show all
          </button>
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
              {rows.length > 0 && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No results match your search{unpaidOnly ? " (unpaid only)" : ""}.
                  </td>
                </tr>
              )}
              {filtered.map((row) => (
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
