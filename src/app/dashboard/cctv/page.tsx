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
import { AddCctvModal } from "@/components/forms/add-cctv-modal";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import { DeleteCctvButton } from "@/components/delete-cctv-button";
import { EditCctvModal } from "@/components/forms/edit-cctv-modal";

export default async function CctvPage() {
  const [jobs] = await Promise.all([
    prisma.cctvInstallation.findMany({
      orderBy: { createdAt: "desc" },
      include: { payments: true },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="CCTV installations" subtitle={`${jobs.length} total`}>
        <AddCctvModal />
      </PageHeader>

      <SearchableDataTable placeholder="Search CCTV by client, site, description, status...">
        <DataTableElement>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Date Started</th>
              <th className="px-4 py-3 font-medium">Description</th>
              <th className="px-4 py-3 font-medium">Total</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No installations yet.
                </td>
              </tr>
            )}
            {jobs.map((j) => {
              const summary = summarizePayments(j.totalAmount, j.payments);

              return (
                <tr
                  key={j.id}
                  data-search-row
                  data-search={toSearchText(
                    j.clientName,
                    j.dateStarted,
                    j.description,
                    formatCurrency(j.totalAmount),
                    j.status,
                    summary.isFullyPaid ? "paid" : summary.paid > 0 ? "partial" : "unpaid"
                  )}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 font-medium">{j.clientName}</td>
                  <td className="px-4 py-3 text-slate-600">{formatDate(j.dateStarted)}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-slate-600">
                    {j.description ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatCurrency(j.totalAmount)}</td>
                  <td className="px-4 py-3">
                    <Badge
                      color={
                        j.status === "COMPLETED"
                          ? "green"
                          : j.status === "IN_PROGRESS"
                            ? "amber"
                            : "slate"
                      }
                    >
                      {j.status.replace("_", " ")}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <PaymentStatus summary={summary} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/dashboard/cctv/${j.id}`}
                      className="text-brand-600 hover:underline"
                    >
                      View
                    </Link>
                    <DeleteCctvButton id={j.id} clientName={j.clientName ?? "Unknown"} />
                    <EditCctvModal
                          job={{
                            id: j.id,
                            status: j.status,
                            totalAmount: Number(j.totalAmount),
                            siteAddress: j.siteAddress ?? "",
                            description: j.description ?? "",
                            dateStarted: j.dateStarted,
                            dateCompleted: j.dateCompleted,
                          }}
                        />
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
