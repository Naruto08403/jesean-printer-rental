"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type PrinterTypeFilterValue = "ALL" | "RENTAL" | "WALK_IN";

export function PrinterTypeFilter({
  value,
  onChange,
}: {
  value: PrinterTypeFilterValue;
  onChange: (value: PrinterTypeFilterValue) => void;
}) {
  const options: { id: PrinterTypeFilterValue; label: string }[] = [
    { id: "ALL", label: "All" },
    { id: "RENTAL", label: "Rental" },
    { id: "WALK_IN", label: "Walk-in" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
            value === opt.id
              ? "border-brand-600 bg-brand-50 text-brand-700"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function usePrinterTypeRowFilter() {
  const [typeFilter, setTypeFilter] = useState<PrinterTypeFilterValue>("ALL");

  function matchesTypeFilter(rowType: string) {
    if (typeFilter === "ALL") return true;
    return rowType === typeFilter;
  }

  return { typeFilter, setTypeFilter, matchesTypeFilter };
}
