"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  calculateDiagnosisTotal,
  formatDiagnosisString,
  type DiagnosisCatalogEntry,
} from "@/lib/repair-diagnosis-catalog";

export function DiagnosisPicker({
  catalog,
  selectedNames,
  onChange,
  disabled = false,
}: {
  catalog: DiagnosisCatalogEntry[];
  selectedNames: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}) {
  const normalizedSelected = useMemo(
    () => new Set(selectedNames.map((name) => name.trim().toLowerCase())),
    [selectedNames]
  );

  const { total } = useMemo(
    () => calculateDiagnosisTotal(selectedNames, catalog),
    [selectedNames, catalog]
  );

  function toggle(name: string) {
    if (disabled) return;
    const key = name.trim().toLowerCase();
    const isSelected = normalizedSelected.has(key);
    if (isSelected) {
      onChange(selectedNames.filter((item) => item.trim().toLowerCase() !== key));
      return;
    }
    onChange([...selectedNames, name]);
  }

  if (catalog.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No diagnosis options yet. Add them under Repairs → Diagnosis prices.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {catalog.map((item) => {
          const checked = normalizedSelected.has(item.name.trim().toLowerCase());
          return (
            <label
              key={item.id}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm ${
                checked
                  ? "border-brand-200 bg-brand-50"
                  : "border-slate-100 hover:bg-slate-50"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => toggle(item.name)}
                />
                <span className="font-medium text-slate-900">{item.name}</span>
              </span>
              <span className="text-slate-600">{formatCurrency(item.price)}</span>
            </label>
          );
        })}
      </div>
      <p className="text-sm text-slate-600">
        Selected total: <strong>{formatCurrency(total)}</strong>
      </p>
      <input type="hidden" name="diagnosis" value={formatDiagnosisString(selectedNames)} />
    </div>
  );
}

export function useDiagnosisSelection(
  catalog: DiagnosisCatalogEntry[],
  selectedNames: string[]
) {
  return useMemo(
    () => calculateDiagnosisTotal(selectedNames, catalog),
    [catalog, selectedNames]
  );
}
