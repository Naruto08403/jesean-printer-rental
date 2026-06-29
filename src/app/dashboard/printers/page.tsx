import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTableElement } from "@/components/data-table";
import {
  SearchableDataTable,
  SearchNoMatchRow,
} from "@/components/searchable-data-table";
import { toSearchText } from "@/lib/search";
import { formatCurrency } from "@/lib/utils";
import { AddPrinterModal } from "@/components/forms/add-printer-modal";
import { ImportPrintersModal } from "@/components/forms/import-printers-modal";

const statusColor: Record<string, "green" | "amber" | "blue" | "slate"> = {
  AVAILABLE: "green",
  RENTED: "blue",
  IN_REPAIR: "amber",
  RETIRED: "slate",
};

export default async function PrintersPage() {
  const printers = await prisma.printer.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { rentals: true, repairs: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Printers" subtitle={`${printers.length} in inventory`}>
        <ImportPrintersModal />
        <AddPrinterModal />
      </PageHeader>

      <SearchableDataTable placeholder="Search printers by brand, model, serial, status...">
        <DataTableElement>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Serial</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Rentals</th>
              <th className="px-4 py-3 font-medium">Repairs</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {printers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No printers yet.
                </td>
              </tr>
            )}
            {printers.map((p) => {
              const unit = [p.brand, p.model].filter(Boolean).join(" ") || "Printer";
              return (
                <tr
                  key={p.id}
                  data-search-row
                  data-search={toSearchText(
                    unit,
                    p.serialNumber,
                    p.price,
                    p.status,
                    p._count.rentals,
                    p._count.repairs
                  )}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-medium">{unit}</td>
                  <td className="px-4 py-3 text-slate-600">{p.serialNumber ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.price != null ? formatCurrency(p.price) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={statusColor[p.status]}>{p.status.replace("_", " ")}</Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p._count.rentals}</td>
                  <td className="px-4 py-3 text-slate-600">{p._count.repairs}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/printers/${p.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              );
            })}
            <SearchNoMatchRow colSpan={7} />
          </tbody>
        </DataTableElement>
      </SearchableDataTable>
    </div>
  );
}
