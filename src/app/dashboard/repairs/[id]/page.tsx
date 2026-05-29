import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { updateRepairStatus } from "@/actions/repairs";
import { PaymentForm } from "@/components/payment-form";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import type { ServiceStatus } from "@prisma/client";

export default async function RepairDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repair = await prisma.repair.findUnique({
    where: { id },
    include: { client: true, printer: true, payments: { orderBy: { paidAt: "desc" } } },
  });
  if (!repair) notFound();

  const summary = summarizePayments(repair.totalAmount, repair.payments);

  async function setStatus(formData: FormData) {
    "use server";
    await updateRepairStatus(id, formData.get("status") as ServiceStatus);
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/repairs" className="text-sm text-brand-600 hover:underline">
        ← Repairs
      </Link>
      <h1 className="text-2xl font-bold">{repair.title}</h1>
      <PaymentStatus summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Record payment</CardTitle>
          <p className="mt-1 text-sm text-slate-500">Partial payments allowed until fully paid.</p>
          <div className="mt-4">
            <PaymentForm target={{ type: "repair", id }} />
          </div>
        </Card>
        <Card>
          <CardTitle>Details</CardTitle>
          <p className="mt-2 text-sm">Client: {repair.client.name}</p>
          <p className="text-sm">Total: {formatCurrency(repair.totalAmount)}</p>
          {repair.printer && (
            <p className="mt-2 text-sm">
              <Link href={`/dashboard/printers/${repair.printer.id}`} className="text-brand-600">
                View printer history
              </Link>
            </p>
          )}
          <form action={setStatus} className="mt-4 flex gap-2">
            <Select name="status" defaultValue={repair.status}>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Button type="submit" variant="secondary">
              Update status
            </Button>
          </form>
        </Card>
      </div>

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
    </div>
  );
}
