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
import { AddRentalModal } from "@/components/forms/add-rental-modal";
import { ImportRentalsModal } from "@/components/forms/import-rentals-modal";
import { PaymentStatus } from "@/components/payment-status";
import { rentalExpectedTotal, summarizePayments } from "@/lib/payments";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function RentalsPage() {
  const [rentals, clients, printers] = await Promise.all([
    prisma.rental.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, printer: true, payments: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.printer.findMany({
      where: { status: { in: ["AVAILABLE", "RENTED"] } },
      orderBy: { brand: "asc" },
    }),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, label: c.name }));
  const printerOptions = printers.map((p) => ({
    id: p.id,
    label: [p.brand, p.model, p.serialNumber].filter(Boolean).join(" "),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Printer rentals" subtitle={`${rentals.length} total`}>
        <ImportRentalsModal />
        <AddRentalModal clients={clientOptions} printers={printerOptions} />
      </PageHeader>

      <SearchableDataTable placeholder="Search rentals by client, printer, status, schedule...">
        <DataTableElement>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Printer</th>
              <th className="px-4 py-3 font-medium">Period</th>
              <th className="px-4 py-3 font-medium">Schedule</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rentals.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No rentals yet.
                </td>
              </tr>
            )}
            {rentals.map((r) => {
              const total = rentalExpectedTotal(r);
              const summary = summarizePayments(total, r.payments);
              const printerLabel = r.printer
                ? [r.printer.brand, r.printer.model, r.printer.serialNumber]
                    .filter(Boolean)
                    .join(" ")
                : "";
              const period = `${formatDate(r.startDate)}${r.endDate ? ` ${formatDate(r.endDate)}` : ""}`;

              return (
                <tr
                  key={r.id}
                  data-search-row
                  data-search={toSearchText(
                    r.client.name,
                    printerLabel,
                    period,
                    r.paymentSchedule,
                    r.status,
                    formatCurrency(summary.paid),
                    formatCurrency(summary.total),
                    summary.isFullyPaid ? "paid" : summary.paid > 0 ? "partial" : "unpaid"
                  )}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-medium">{r.client.name}</td>
                  <td className="px-4 py-3 text-slate-600">{printerLabel || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(r.startDate)}
                    {r.endDate ? ` – ${formatDate(r.endDate)}` : ""}
                  </td>
                  <td className="px-4 py-3 capitalize text-slate-600">
                    {r.paymentSchedule.toLowerCase()}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={r.status === "ACTIVE" ? "green" : "slate"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <PaymentStatus summary={summary} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/rentals/${r.id}`}
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
