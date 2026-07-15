import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { getRepairDeviceTimeline, getRepairFormOptions } from "@/actions/repairs";
import { EditRepairJobForm, type RepairEdit } from "@/components/forms/edit-repair-job-form";
import { DeleteRepairButton } from "@/components/forms/delete-repair-button";
import { PaymentForm } from "@/components/payment-form";
import { PaymentStatus } from "@/components/payment-status";
import { RepairDeviceHistory } from "@/components/repair-device-history";
import { summarizePayments } from "@/lib/payments";
import {
  formatRepairCustomerLabel,
  formatRepairPrinterLabel,
  repairDisplayTitle,
  sourceLabel,
} from "@/lib/repair-device";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

function toDateInput(d: Date | null | undefined) {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [repair, options, timeline] = await Promise.all([
    prisma.repair.findUnique({
      where: { id },
      include: {
        client: true,
        printer: true,
        payments: { orderBy: { paidAt: "desc" } },
        diagnosisLines: { orderBy: { sortOrder: "asc" } },
      },
    }),
    getRepairFormOptions(),
    prisma.repair
      .findUnique({ where: { id }, select: { serialNumber: true, brand: true, model: true } })
      .then((r) =>
        r ? getRepairDeviceTimeline(r.serialNumber, r.brand, r.model) : []
      ),
  ]);
  if (!repair) notFound();

  const summary = summarizePayments(repair.totalAmount, repair.payments);

  const defaultRentalId =
    options.rentalPrinters.find((r) => r.printerId === repair.printerId)?.rentalId ?? "";

  const repairEdit: RepairEdit = {
    id: repair.id,
    source: repair.source,
    clientId: repair.clientId,
    customerName: repair.customerName,
    printerId: repair.printerId,
    linkedFromRepairId: repair.linkedFromRepairId,
    brand: repair.brand,
    model: repair.model,
    serialNumber: repair.serialNumber,
    problem: repair.problem,
    diagnosis: repair.diagnosis,
    pricingMode: repair.pricingMode,
    diagnosisLines: repair.diagnosisLines.map((line) => ({
      name: line.name,
      price: line.price,
    })),
    status: repair.status,
    totalAmount: repair.totalAmount,
    isChargeWaived: repair.isChargeWaived,
    billingDate: repair.billingDate ? toDateInput(repair.billingDate) : null,
    receivedAt: toDateInput(repair.receivedAt),
    completedAt: toDateInput(repair.completedAt),
    notes: repair.description ?? "",
    defaultRentalId,
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/repairs" className="text-sm text-brand-600 hover:underline">
        ← Repairs
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{repairDisplayTitle(repair)}</h1>
          <p className="mt-1 text-slate-600">
            {formatRepairPrinterLabel(repair)} · {formatRepairCustomerLabel(repair)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge color="slate">{sourceLabel(repair.source)}</Badge>
          {repair.isChargeWaived && <Badge color="green">No charge</Badge>}
          <Badge
            color={
              repair.status === "COMPLETED"
                ? "green"
                : repair.status === "IN_PROGRESS"
                  ? "amber"
                  : "slate"
            }
          >
            {repair.status.replace("_", " ")}
          </Badge>
          <DeleteRepairButton
            repairId={repair.id}
            paymentCount={repair.payments.length}
          />
        </div>
      </div>

      {!repair.isChargeWaived && repair.totalAmount > 0 && (
        <PaymentStatus
          summary={summary}
          billing={repair.billingDate?.toISOString() ?? null}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {!repair.isChargeWaived && repair.totalAmount > 0 && (
          <Card>
            <CardTitle>Record payment</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Partial payments allowed until fully paid. For multiple jobs, use{" "}
              <strong>Add payment</strong> on the Repairs list.
            </p>
            <div className="mt-4">
              <PaymentForm target={{ type: "repair", id }} />
            </div>
          </Card>
        )}
        <Card className={repair.isChargeWaived ? "lg:col-span-2" : ""}>
          <CardTitle>Edit repair job</CardTitle>
          <EditRepairJobForm repair={repairEdit} options={options} />
        </Card>
      </div>

      <Card>
        <CardTitle>Device repair history</CardTitle>
        <div className="mt-4">
          <RepairDeviceHistory repairs={timeline} currentId={id} />
        </div>
      </Card>

      {!repair.isChargeWaived && repair.payments.length > 0 && (
        <Card>
          <CardTitle>Payments</CardTitle>
          <ul className="mt-4 divide-y text-sm">
            {repair.payments.map((p) => (
              <li key={p.id} className="flex justify-between py-3">
                <span>{formatDate(p.paidAt)}</span>
                <span className="font-semibold">{formatCurrency(p.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
