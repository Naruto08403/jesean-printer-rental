"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchableDataTable({
  children,
  placeholder = "Search...",
  noMatchMessage = "No results match your search.",
  className,
}: {
  children: React.ReactNode;
  placeholder?: string;
  noMatchMessage?: string;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const q = query.trim().toLowerCase();
    let visible = 0;

    root.querySelectorAll("[data-search-row]").forEach((row) => {
      const text = row.getAttribute("data-search")?.toLowerCase() ?? "";
      const match = !q || text.includes(q);
      (row as HTMLElement).style.display = match ? "" : "none";
      if (match) visible++;
    });

    const noMatch = root.querySelector("[data-search-no-match]") as HTMLElement | null;
    if (noMatch) {
      const hasRows = root.querySelectorAll("[data-search-row]").length > 0;
      noMatch.style.display = hasRows && q && visible === 0 ? "" : "none";
    }
  }, [query]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pr-9 pl-9"
          aria-label={placeholder}
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
        <div ref={containerRef} className="overflow-x-auto">
          {children}
        </div>
      </Card>
    </div>
  );
}

export function SearchNoMatchRow({
  colSpan,
  message,
}: {
  colSpan: number;
  message?: string;
}) {
  return (
    <tr data-search-no-match className="hidden">
      <td colSpan={colSpan} className="px-4 py-8 text-center text-slate-500">
        {message ?? "No results match your search."}
      </td>
    </tr>
  );
}
