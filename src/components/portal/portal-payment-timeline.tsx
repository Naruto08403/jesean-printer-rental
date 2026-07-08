"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

const typeFilters = ["All", "Rental", "Repair", "Purchase", "CCTV"] as const;
const PAGE_SIZE = 10;

function paymentYear(payment: PortalPaymentItem): number {
  return new Date(payment.paidAt).getFullYear();
}

function matchesSearch(payment: PortalPaymentItem, query: string): boolean {
  const haystack = [
    payment.label,
    payment.type,
    payment.method,
    payment.reference,
    formatCurrency(payment.amount),
    formatDate(payment.paidAt),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

export function PortalPaymentTimeline({ payments }: { payments: PortalPaymentItem[] }) {
  const [typeFilter, setTypeFilter] = useState<(typeof typeFilters)[number]>("All");
  const [year, setYear] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const years = useMemo(() => {
    const unique = new Set(payments.map(paymentYear));
    return Array.from(unique).sort((a, b) => b - a);
  }, [payments]);

  const filtered = useMemo(() => {
    let list = payments;

    if (typeFilter !== "All") {
      list = list.filter((p) => p.type === typeFilter);
    }

    if (year !== "all") {
      const selectedYear = Number(year);
      list = list.filter((p) => paymentYear(p) === selectedYear);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => matchesSearch(p, q));
    }

    return list;
  }, [payments, typeFilter, year, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, year, query]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, currentPage]);

  const total = filtered.reduce((sum, p) => sum + p.amount, 0);
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, filtered.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            type="search"
            placeholder="Search label, type, method, OR#, amount…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-9"
            aria-label="Search payments"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="w-full sm:w-36"
          aria-label="Filter by year"
        >
          <option value="all">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {typeFilters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTypeFilter(f)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              typeFilter === f
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
          Showing {rangeStart}–{rangeEnd} of {filtered.length} payment
          {filtered.length === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold text-emerald-700">{formatCurrency(total)}</span> total
        </p>
      )}

      <ul className="space-y-3">
        {paginated.map((p) => (
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
            {query || year !== "all" || typeFilter !== "All"
              ? "No payments match your filters."
              : "No payments in this category yet."}
          </li>
        )}
      </ul>

      {filtered.length > PAGE_SIZE && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 pt-4 sm:flex-row">
          <p className="text-sm text-slate-500">
            Page {currentPage} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="px-3 py-1.5"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
