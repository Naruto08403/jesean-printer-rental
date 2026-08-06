import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { DataTableElement } from "@/components/data-table";
import { Edit, Trash2 } from "lucide-react";
import { DeleteSaleButton } from "@/components/delete-sale-button";
import { EditSaleModal } from "@/components/forms/edit-sale-modal";
import {
  SearchableDataTable,
  SearchNoMatchRow,
} from "@/components/searchable-data-table";
import { toSearchText } from "@/lib/search";
import { AddSaleModal } from "@/components/forms/add-sale-modal";
import { listActiveInventoryForSale } from "@/actions/inventory";
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
  const [sales, clients, products] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, payments: true, lines: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    listActiveInventoryForSale(),
  ]);

  const clientOptions = clients.map((c) => ({ id: c.id, label: c.name }));

  return (
    <div className="space-y-6">
      <PageHeader title="Sales" subtitle={`${sales.length} total · stock deducted from inventory`}>
        <AddSaleModal clients={clientOptions} products={products} />
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
              <th className="px-4 py-3 font-medium text-right">Actions</th>
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
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">

                      <Link
                        href={`/dashboard/sales/${s.id}`}
                        className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-100"
                      >
                        View
                      </Link>

                      <EditSaleModal sale={s} clients={clientOptions} products={products}>
                        <button
                          className="rounded-md border border-blue-200 bg-blue-50 p-2 text-blue-600 hover:bg-blue-100"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </EditSaleModal>

                      <DeleteSaleButton id={s.id}>
                        <button
                          className="rounded-md border border-red-200 bg-red-50 p-2 text-red-600 hover:bg-red-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </DeleteSaleButton>

                    </div>
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
