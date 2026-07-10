"use client";

import { Download } from "lucide-react";

export function ExportRentalsButton() {
  const exportExcel = () => {
    window.open("/api/rentals/export", "_blank");
  };

  return (
    <button
      onClick={exportExcel}
      className="inline-flex items-center gap-2 rounded-md border px-3 py-2"
    >
      <Download className="h-4 w-4" />
      Export Excel
    </button>
  );
}