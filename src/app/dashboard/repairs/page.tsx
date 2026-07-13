import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { toSearchText } from "@/lib/search";
import { AddRepairModal } from "@/components/forms/add-repair-modal";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency } from "@/lib/utils";
import {
  formatRepairCustomerLabel,
  formatRepairPrinterLabel,
  repairDisplayTitle,
} from "@/lib/repair-device";
import { repairClientKey } from "@/lib/repair-client-key";
import { getRepairFormOptions } from "@/actions/repairs";
import { getRepairPaymentOptions } from "@/actions/payments";
import { AddRepairPaymentModal } from "@/components/forms/add-repair-payment-modal";
import { GenerateRepairBillingModal } from "@/components/forms/generate-repair-billing-modal";
import { RepairsWorkspace, type RepairListRow } from "@/components/repairs-workspace";
import type { RepairDetailPayload } from "@/components/forms/repair-view-modal";

function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export default async function RepairsPage() {
  const [repairs, formOptions, paymentOptions] = await Promise.all([
    prisma.repair.findMany({
      orderBy: { customerName: "asc" },
      include: { client: true, printer: true, payments: true },
    }),
    getRepairFormOptions(),
    getRepairPaymentOptions(),
  ]);

  const repairDetails: Record<string, RepairDetailPayload> = {};

  const rows: RepairListRow[] = repairs.map((r) => {
    const paymentSummary = summarizePayments(r.totalAmount, r.payments);
    const printerLabel = formatRepairPrinterLabel(r);
    const customerLabel = formatRepairCustomerLabel(r);
    const serial =
      r.serialNumber?.trim() || r.printer?.serialNumber?.trim() || null;
    const clientKey = repairClientKey(r.clientId, customerLabel);

    const isUnpaid =
      !r.isChargeWaived &&
      r.totalAmount > 0 &&
      !paymentSummary.isFullyPaid;

    const defaultRentalId =
      formOptions.rentalPrinters.find((rp) => rp.printerId === r.printerId)?.rentalId ?? "";

    repairDetails[r.id] = {
      id: r.id,
      title: repairDisplayTitle(r),
      subtitle: `${printerLabel} · ${customerLabel}`,
      source: r.source,
      status: r.status,
      isChargeWaived: r.isChargeWaived,
      paymentSummary,
      payments: r.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        paidAt: p.paidAt.toISOString(),
        method: p.method,
        reference: p.reference,
      })),
      edit: {
        id: r.id,
        source: r.source,
        clientId: r.clientId,
        customerName: r.customerName,
        printerId: r.printerId,
        linkedFromRepairId: r.linkedFromRepairId,
        brand: r.brand,
        model: r.model,
        serialNumber: r.serialNumber,
        problem: r.problem,
        diagnosis: r.diagnosis,
        status: r.status,
        totalAmount: r.totalAmount,
        isChargeWaived: r.isChargeWaived,
        receivedAt: toDateInput(r.receivedAt),
        completedAt: toDateInput(r.completedAt),
        notes: r.description ?? "",
        defaultRentalId,
      },
    };

    return {
      id: r.id,
      clientKey,
      receivedAt: r.receivedAt.toISOString(),
      customerLabel,
      printerLabel,
      serialNumber: serial,
      amountLabel: r.isChargeWaived
        ? "No charge"
        : formatCurrency(r.totalAmount),
      isChargeWaived: r.isChargeWaived,
      paymentSummary,
      paymentCount: r.payments.length,
      isUnpaid,
      searchText: toSearchText(
        customerLabel,
        printerLabel,
        serial,
        r.serialNumber,
        r.printer?.serialNumber,
        r.brand,
        r.model,
        r.printer?.brand,
        r.printer?.model,
        repairDisplayTitle(r),
        r.diagnosis,
        formatCurrency(r.totalAmount),
        formatCurrency(paymentSummary.balance)
      ),
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Repairs" subtitle={`${repairs.length} total · rentals, walk-ins & history`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/repairs/diagnoses"
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Diagnosis prices
          </Link>
          <GenerateRepairBillingModal repairs={paymentOptions} />
          <AddRepairPaymentModal repairs={paymentOptions} />
          <AddRepairModal options={formOptions} />
        </div>
      </PageHeader>

      <RepairsWorkspace
        rows={rows}
        paymentOptions={paymentOptions}
        formOptions={formOptions}
        repairDetails={repairDetails}
      />
    </div>
  );
}
