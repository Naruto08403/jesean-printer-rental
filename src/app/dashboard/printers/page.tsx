import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { DataTableElement } from "@/components/data-table";
import { SearchNoMatchRow } from "@/components/searchable-data-table";
import { PrintersDataTable } from "@/components/printers-data-table";
import { toSearchText } from "@/lib/search";
import { formatCurrency } from "@/lib/utils";
import { formatPrinterOwnerLabel, printerTypeLabel } from "@/lib/printer";
import { AddPrinterModal } from "@/components/forms/add-printer-modal";
import { ImportPrintersModal } from "@/components/forms/import-printers-modal";

const statusColor: Record<string, "green" | "amber" | "blue"> = {
  AVAILABLE: "green",
  RENTED: "blue",
  IN_REPAIR: "amber",
  RETIRED: "blue",
  CLIENT_PERSONAL: "blue",
};

const typeColor: Record<string, "blue" | "amber" | "slate"> = {
  RENTAL: "blue",
  WALK_IN: "amber",
  CLIENT_PERSONAL: "slate",
  SLATE: "slate",
};

export default async function PrintersPage() {
  const [printers, clients = []] = await Promise.all([
  prisma.printer.findMany({
    orderBy: [
      {
        ownerClient: {
          name: "asc",
        },
      },
      {
        brand: "asc",
      },
      {
        model: "asc",
      },
    ],
    include: {
      ownerClient: {
        select: {
          name: true,
        },
      },
      rentals: {
        where: {
          status: "ACTIVE", // adjust if your active status is different
        },
        take: 1,
        include: {
          client: {
            select: {
              name: true,
            },
          },
        },
      },
      _count: {
        select: {
          rentals: true,
          repairs: true,
        },
      },
    },
  }),
    
]);

  const rentalCount = printers.filter((p) => p.type === "RENTAL").length;
  const walkInCount = printers.filter((p) => p.type === "WALK_IN").length;
 
  return (
    <div className="space-y-6">
      <PageHeader
        title="Printers"
        subtitle={`${printers.length} total · ${rentalCount} rental · ${walkInCount} walk-in`}
      >
        <ImportPrintersModal />
        <AddPrinterModal clients={clients} />
      </PageHeader>

      <PrintersDataTable placeholder="Search printers by brand, model, serial, owner, status...">
        <DataTableElement>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="px-4 py-3 font-medium">Unit</th>
              <th className="px-4 py-3 font-medium">Serial</th>
              {/* <th className="px-4 py-3 font-medium">Type</th> */}
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Price</th>
              {/* <th className="px-4 py-3 font-medium">Status</th> */}
              {/* <th className="px-4 py-3 font-medium">Rentals</th> */}
              <th className="px-4 py-3 font-medium">Repairs</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {printers.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No printers yet.
                </td>
              </tr>
            )}
            {printers.map((p) => {
              const unit = [p.brand, p.model].filter(Boolean).join(" ") || "Printer";
              let owner: string;

                if (p.type === "WALK_IN") {
                  owner = p.ownerClient?.name ?? "—";
                } else if (p.type === "RENTAL") {
                  const activeRental = p.rentals[0];

                  owner = activeRental
                    ? `RENTED - ${activeRental.client.name}`
                    : "Admin";
                } else {
                  owner = "Admin";
                }
              return (
                <tr
                  key={p.id}
                  data-search-row
                  data-printer-type={p.type}
                  data-search={toSearchText(
                    unit,
                    p.serialNumber,
                    // p.type,
                    printerTypeLabel(p.type),
                    owner,
                    p.price,
                    p.status,
                    // p._count.rentals,
                    p._count.repairs
                  )}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-medium">{unit}</td>
                  <td className="px-4 py-3 text-slate-600">{p.serialNumber ?? "—"}</td>
                  {/* <td className="px-4 py-3">
                    <Badge color={typeColor[p.type]}>{printerTypeLabel(p.type)}</Badge>
                  </td> */}
                  <td className="px-4 py-3 text-slate-600">{owner}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.price != null ? formatCurrency(p.price) : "—"}
                  </td>
                  {/* <td className="px-4 py-3">
                    <Badge color={statusColor[p.status]}>{p.status.replace("_", " ")}</Badge>
                  </td> */}
                  {/* <td className="px-4 py-3 text-slate-600">{p._count.rentals}</td> */}
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
            <SearchNoMatchRow colSpan={9} />
          </tbody>
        </DataTableElement>
      </PrintersDataTable>
    </div>
  );
}
