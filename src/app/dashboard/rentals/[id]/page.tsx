import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { updateRentalStatus } from "@/actions/rentals";
import type { RentalStatus } from "@prisma/client";
import { PaymentForm } from "@/components/payment-form";
import { PaymentStatus } from "@/components/payment-status";
import { rentalExpectedTotal, summarizePayments } from "@/lib/payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export default async function RentalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rental = await prisma.rental.findUnique({
    where: { id },
    include: {
      client: true,
      printer: true,
      payments: { orderBy: { paidAt: "desc" } },
    },
  });
  if (!rental) notFound();

  const total = rentalExpectedTotal(rental);
  const summary = summarizePayments(total, rental.payments);

  async function setStatus(formData: FormData) {
    "use server";
    await updateRentalStatus(id, formData.get("status") as RentalStatus);
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/rentals" className="text-sm text-brand-600 hover:underline">
        ← Rentals
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{rental.client.name}</h1>
          <p className="text-slate-500">
            {rental.paymentSchedule.toLowerCase()} · Started {formatDate(rental.startDate)}
          </p>
        </div>
        <PaymentStatus summary={summary} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Record payment</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Rentals support partial and quarterly payments until the contract is fully paid.
          </p>
          <div className="mt-4">
            <PaymentForm target={{ type: "rental", id }} />
          </div>
        </Card>

        <Card>
          <CardTitle>Status</CardTitle>
          <form action={setStatus} className="mt-4 flex gap-2">
            <Select name="status" defaultValue={rental.status} className="flex-1">
              <option value="ACTIVE">Active</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <Button type="submit" variant="secondary">
              Update
            </Button>
          </form>
          {rental.printer && (
            <p className="mt-4 text-sm">
              Printer:{" "}
              <Link href={`/dashboard/printers/${rental.printer.id}`} className="text-brand-600">
                {rental.printer.brand} {rental.printer.model}
              </Link>
            </p>
          )}
          <p className="mt-2 text-sm">
            Expected total: <strong>{formatCurrency(total)}</strong>
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Payment history</CardTitle>
        <ul className="mt-4 divide-y text-sm">
          {rental.payments.map((p) => (
            <li key={p.id} className="flex justify-between py-3">
              <span>
                {formatDate(p.paidAt)} · {p.method ?? "—"}
                {p.reference && ` · ${p.reference}`}
              </span>
              <span className="font-semibold">{formatCurrency(p.amount)}</span>
            </li>
          ))}
          {rental.payments.length === 0 && (
            <li className="py-4 text-slate-500">No payments recorded</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
