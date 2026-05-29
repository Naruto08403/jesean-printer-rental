import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DataTableElement } from "@/components/data-table";
import {
  SearchableDataTable,
  SearchNoMatchRow,
} from "@/components/searchable-data-table";
import { toSearchText } from "@/lib/search";
import { AddSaleModal } from "@/components/forms/add-sale-modal";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency, formatDate } from "@/lib/utils";

function formatItems(items: string) {
  try {
    const parsed = JSON.parse(items) as { name: string }[];
    return parsed.map((i) => i.name).join(", ");
  } catch {
    return items;
  }
}

export default async function SalesPage() {
  const [sales, clients] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, payments: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, label: c.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" subtitle={`Inks & supplies · ${sales.length} total`}>
        <AddSaleModal clients={clientOptions} />
      </PageHeader>

      <SearchableDataTable placeholder="Search sales by items, client, amount...">
        <DataTableElement>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="px-4 py-3 font-medium">Items</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {sales.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No sales yet.
                </td>
              </tr>
            )}
            {sales.map((s) => {
              const summary = summarizePayments(s.totalAmount, s.payments);
              const itemsLabel = formatItems(s.items);
              const clientName = s.client?.name ?? "Walk-in";

              return (
                <tr
                  key={s.id}
                  data-search-row
                  data-search={toSearchText(
                    itemsLabel,
                    clientName,
                    formatDate(s.createdAt),
                    formatCurrency(s.totalAmount),
                    summary.isFullyPaid ? "paid" : summary.paid > 0 ? "partial" : "unpaid"
                  )}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="max-w-[200px] truncate px-4 py-3 font-medium">
                    {itemsLabel}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{clientName}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(s.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <PaymentStatus summary={summary} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/sales/${s.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              );
            })}
            <SearchNoMatchRow colSpan={6} />
          </tbody>
        </DataTableElement>
      </SearchableDataTable>
    </div>
  );
}
