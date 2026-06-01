import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { updateRepair } from "@/actions/repairs";
import { getRepairDeviceTimeline } from "@/actions/repairs";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getRepairFormOptions } from "@/actions/repairs";

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
      include: { client: true, printer: true, payments: { orderBy: { paidAt: "desc" } } },
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

  async function saveRepair(formData: FormData) {
    "use server";
    await updateRepair(id, formData);
  }

  const defaultRentalId =
    options.rentalPrinters.find((r) => r.printerId === repair.printerId)?.rentalId ?? "";

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
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

      {!repair.isChargeWaived && repair.totalAmount > 0 && (
        <PaymentStatus summary={summary} />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {!repair.isChargeWaived && repair.totalAmount > 0 && (
          <Card>
            <CardTitle>Record payment</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Partial payments allowed until fully paid.</p>
            <div className="mt-4">
              <PaymentForm target={{ type: "repair", id }} />
            </div>
          </Card>
        )}
        <Card className={repair.isChargeWaived ? "lg:col-span-2" : ""}>
          <CardTitle>Edit repair job</CardTitle>
          <form action={saveRepair} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="source" value={repair.source} />
            <input type="hidden" name="printerId" value={repair.printerId ?? ""} />
            <input type="hidden" name="rentalId" value={defaultRentalId} />
            <input type="hidden" name="historyRepairId" value={repair.linkedFromRepairId ?? ""} />
            <input type="hidden" name="brand" value={repair.brand ?? ""} />
            <input type="hidden" name="model" value={repair.model ?? ""} />
            <input type="hidden" name="serialNumber" value={repair.serialNumber ?? ""} />

            <div>
              <Label>Client</Label>
              <Select name="clientId" defaultValue={repair.clientId ?? ""} className="mt-1">
                <option value="">Walk-in</option>
                {options.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Customer name</Label>
              <Input name="customerName" defaultValue={repair.customerName ?? ""} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Problem</Label>
              <Input name="problem" defaultValue={repair.problem} required className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Diagnosis</Label>
              <Input name="diagnosis" defaultValue={repair.diagnosis ?? ""} className="mt-1" />
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue={repair.status} className="mt-1">
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
            <div>
              <Label>Price (PHP)</Label>
              <Input
                name="totalAmount"
                type="number"
                step="0.01"
                min="0"
                defaultValue={repair.totalAmount}
                disabled={repair.isChargeWaived}
                className="mt-1"
              />
              {repair.isChargeWaived && (
                <input type="hidden" name="isChargeWaived" value="true" />
              )}
            </div>
            <div>
              <Label>Date received</Label>
              <Input
                name="receivedAt"
                type="date"
                required
                defaultValue={toDateInput(repair.receivedAt)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Date returned / completed</Label>
              <Input
                name="completedAt"
                type="date"
                defaultValue={toDateInput(repair.completedAt)}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Input name="notes" defaultValue={repair.description ?? ""} className="mt-1" />
            </div>
            {repair.printerId && (
              <p className="sm:col-span-2 text-sm">
                <Link href={`/dashboard/printers/${repair.printerId}`} className="text-brand-600 hover:underline">
                  View printer in inventory
                </Link>
              </p>
            )}
            <div className="sm:col-span-2">
              <Button type="submit">Save changes</Button>
            </div>
          </form>
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
