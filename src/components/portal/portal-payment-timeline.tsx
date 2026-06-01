"use client";

import { useMemo, useState } from "react";
import { formatCurrency, formatDate } from "@/lib/utils";

export type PortalPaymentItem = {
  id: string;
  amount: number;
  paidAt: Date;
  method: string | null;
  reference: string | null;
  type: "Rental" | "Repair" | "Purchase" | "CCTV";
  label: string;
};

const filters = ["All", "Rental", "Repair", "Purchase", "CCTV"] as const;

export function PortalPaymentTimeline({ payments }: { payments: PortalPaymentItem[] }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const filtered = useMemo(() => {
    if (filter === "All") return payments;
    return payments.filter((p) => p.type === filter);
  }, [payments, filter]);

  const total = filtered.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filter === f
                ? "bg-brand-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-brand-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length > 0 && (
        <p className="text-sm text-slate-500">
          Showing {filtered.length} payment{filtered.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-emerald-700">{formatCurrency(total)}</span> total
        </p>
      )}

      <ul className="space-y-3">
        {filtered.map((p) => (
          <li
            key={p.id}
            className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col items-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xs font-bold text-emerald-700">
                {p.type.slice(0, 2).toUpperCase()}
              </span>
              <span className="mt-2 h-full w-px bg-slate-100" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-900">{p.label}</p>
                  <p className="text-xs text-slate-500">
                    {p.type} · {formatDate(p.paidAt)}
                    {p.method && ` · ${p.method}`}
                    {p.reference && ` · OR# ${p.reference}`}
                  </p>
                </div>
                <span className="text-lg font-bold text-emerald-700">
                  {formatCurrency(p.amount)}
                </span>
              </div>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
            No payments in this category yet.
          </li>
        )}
      </ul>
    </div>
  );
}
