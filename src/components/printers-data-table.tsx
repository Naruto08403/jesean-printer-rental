"use client";

import { useCallback, useState } from "react";
import { SearchableDataTable } from "@/components/searchable-data-table";
import {
  PrinterTypeFilter,
  type PrinterTypeFilterValue,
} from "@/components/printer-type-filter";

export function PrintersDataTable({
  children,
  placeholder,
}: {
  children: React.ReactNode;
  placeholder?: string;
}) {
  const [typeFilter, setTypeFilter] = useState<PrinterTypeFilterValue>("ALL");

  const additionalRowFilter = useCallback(
    (row: HTMLElement) => {
      if (typeFilter === "ALL") return true;
      return row.getAttribute("data-printer-type") === typeFilter;
    },
    [typeFilter]
  );

  return (
    <div className="space-y-3">
      <PrinterTypeFilter value={typeFilter} onChange={setTypeFilter} />
      <SearchableDataTable
        placeholder={placeholder}
        additionalRowFilter={additionalRowFilter}
      >
        {children}
      </SearchableDataTable>
    </div>
  );
}
