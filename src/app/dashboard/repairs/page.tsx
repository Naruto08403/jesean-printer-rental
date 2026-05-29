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
import { AddRepairModal } from "@/components/forms/add-repair-modal";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency } from "@/lib/utils";

export default async function RepairsPage() {
  const [repairs, clients, printers] = await Promise.all([
    prisma.repair.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, printer: true, payments: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.printer.findMany({ orderBy: { brand: "asc" } }),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, label: c.name }));
  const printerOptions = printers.map((p) => ({
    id: p.id,
    label: [p.brand, p.model].filter(Boolean).join(" ") || p.serialNumber || "Printer",
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Repairs" subtitle={`${repairs.length} total`}>
        <AddRepairModal clients={clientOptions} printers={printerOptions} />
      </PageHeader>

      <SearchableDataTable placeholder="Search repairs by title, client, printer, status...">
        <DataTableElement>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="px-4 py-3 font-medium">Title</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Printer</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {repairs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No repairs yet.
                </td>
              </tr>
            )}
            {repairs.map((r) => {
              const summary = summarizePayments(r.totalAmount, r.payments);
              const printerLabel = r.printer
                ? [r.printer.brand, r.printer.model, r.printer.serialNumber]
                    .filter(Boolean)
                    .join(" ")
                : "";

              return (
                <tr
                  key={r.id}
                  data-search-row
                  data-search={toSearchText(
                    r.title,
                    r.client.name,
                    printerLabel,
                    formatCurrency(r.totalAmount),
                    r.status,
                    formatCurrency(summary.paid),
                    summary.isFullyPaid ? "paid" : summary.paid > 0 ? "partial" : "unpaid"
                  )}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-medium">{r.title}</td>
                  <td className="px-4 py-3 text-slate-600">{r.client.name}</td>
                  <td className="px-4 py-3 text-slate-600">{printerLabel || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(r.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      color={
                        r.status === "COMPLETED"
                          ? "green"
                          : r.status === "IN_PROGRESS"
                            ? "amber"
                            : "slate"
                      }
                    >
                      {r.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <PaymentStatus summary={summary} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/repairs/${r.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      View
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
