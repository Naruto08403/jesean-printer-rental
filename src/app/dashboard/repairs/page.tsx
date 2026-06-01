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
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  formatRepairCustomerLabel,
  formatRepairPrinterLabel,
  repairDisplayTitle,
  sourceLabel,
} from "@/lib/repair-device";
import { getRepairFormOptions } from "@/actions/repairs";

export default async function RepairsPage() {
  const [repairs, formOptions] = await Promise.all([
    prisma.repair.findMany({
      orderBy: { receivedAt: "desc" },
      include: { client: true, printer: true, payments: true },
    }),
    getRepairFormOptions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Repairs" subtitle={`${repairs.length} total · rentals, walk-ins & history`}>
        <AddRepairModal options={formOptions} />
      </PageHeader>

      <SearchableDataTable placeholder="Search repairs by customer, printer, serial, problem...">
        <DataTableElement>
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Customer</th>
              <th className="px-4 py-3 font-medium">Printer</th>
              <th className="px-4 py-3 font-medium">Problem</th>
              <th className="px-4 py-3 font-medium">Source</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {repairs.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-slate-500">
                  No repairs yet.
                </td>
              </tr>
            )}
            {repairs.map((r) => {
              const summary = summarizePayments(r.totalAmount, r.payments);
              const printerLabel = formatRepairPrinterLabel(r);
              const customerLabel = formatRepairCustomerLabel(r);

              return (
                <tr
                  key={r.id}
                  data-search-row
                  data-search={toSearchText(
                    repairDisplayTitle(r),
                    customerLabel,
                    printerLabel,
                    r.serialNumber,
                    r.problem,
                    r.diagnosis,
                    sourceLabel(r.source),
                    formatCurrency(r.totalAmount),
                    r.status,
                    formatDate(r.receivedAt)
                  )}
                  className="border-b border-slate-50 hover:bg-slate-50/50"
                >
                  <td className="px-4 py-3 text-slate-600">{formatDate(r.receivedAt)}</td>
                  <td className="px-4 py-3 text-slate-600">{customerLabel}</td>
                  <td className="px-4 py-3 text-slate-600">{printerLabel}</td>
                  <td className="px-4 py-3 font-medium max-w-[200px] truncate" title={repairDisplayTitle(r)}>
                    {repairDisplayTitle(r)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={r.source === "RENTAL" ? "green" : "slate"}>
                      {sourceLabel(r.source)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.isChargeWaived ? (
                      <span className="text-emerald-700">No charge</span>
                    ) : (
                      formatCurrency(r.totalAmount)
                    )}
                  </td>
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
                    {r.isChargeWaived ? (
                      <span className="text-xs text-slate-400">—</span>
                    ) : (
                      <PaymentStatus summary={summary} />
                    )}
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
            <SearchNoMatchRow colSpan={9} />
          </tbody>
        </DataTableElement>
      </SearchableDataTable>
    </div>
  );
}
