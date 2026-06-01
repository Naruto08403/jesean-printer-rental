import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { updateRentalStatus, addRentalNote } from "@/actions/rentals";
import type { RentalStatus } from "@prisma/client";
import { PaymentForm } from "@/components/payment-form";
import { RentalAnnualPayments } from "@/components/rentals-annual-view";
import { defaultRentalAnnualYear, RENTAL_ANNUAL_START_YEAR } from "@/lib/rental-annual";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RentalPausePeriodsCard } from "@/components/rental-pause-periods-card";
import { GenerateBillingModal } from "@/components/forms/generate-billing-modal";
import { getClientPaymentSuggestion } from "@/lib/rental-annual";

const statusBadge: Record<string, "green" | "amber" | "slate" | "red"> = {
  ACTIVE: "green",
  PAUSED: "amber",
  COMPLETED: "slate",
  CANCELLED: "red",
};

export default async function RentalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const initialYear = yearParam
    ? Math.max(RENTAL_ANNUAL_START_YEAR, parseInt(yearParam, 10))
    : defaultRentalAnnualYear();

  const rental = await prisma.rental.findUnique({
    where: { id },
    include: {
      client: true,
      printer: true,
      payments: { orderBy: { paidAt: "desc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
      pausePeriods: { orderBy: { pausedAt: "asc" } },
    },
  });
  if (!rental) notFound();

  const clientRentals = await prisma.rental.findMany({
    where: { clientId: rental.clientId, status: { in: ["ACTIVE", "PAUSED"] } },
    include: { printer: true },
  });
  const billingSuggestion = getClientPaymentSuggestion(clientRentals);
  const billingClient = {
    id: rental.client.id,
    label: rental.client.name,
    monthlyPayable: billingSuggestion?.monthlyPayable ?? 0,
    unitCount: billingSuggestion?.unitCount ?? 0,
  };

  const rentalData = {
    id: rental.id,
    status: rental.status,
    startDate: rental.startDate.toISOString(),
    endDate: rental.endDate?.toISOString() ?? null,
    ratePerPeriod: rental.ratePerPeriod,
    paymentSchedule: rental.paymentSchedule,
    client: {
      id: rental.client.id,
      name: rental.client.name,
      status: rental.client.status,
    },
    printer: rental.printer
      ? {
          brand: rental.printer.brand,
          model: rental.printer.model,
          serialNumber: rental.printer.serialNumber,
          price: rental.printer.price,
        }
      : null,
    payments: rental.payments.map((p) => ({
      amount: p.amount,
      paidAt: p.paidAt.toISOString(),
      billingYear: p.billingYear,
      billingMonth: p.billingMonth,
    })),
    pausePeriods: rental.pausePeriods.map((pp) => ({
      id: pp.id,
      pausedAt: pp.pausedAt.toISOString(),
      resumedAt: pp.resumedAt?.toISOString() ?? null,
    })),
  };

  async function setStatus(formData: FormData) {
    "use server";
    await updateRentalStatus(id, formData.get("status") as RentalStatus);
  }

  async function addNote(formData: FormData) {
    "use server";
    await addRentalNote(id, String(formData.get("note") ?? ""));
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/rentals" className="text-sm text-brand-600 hover:underline">
        ← Rentals
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{rental.client.name}</h1>
            <Badge color={statusBadge[rental.status] ?? "slate"}>
              {rental.status.replace("_", " ")}
            </Badge>
          </div>
          <p className="text-slate-500">
            {rental.paymentSchedule.toLowerCase()} · Started {formatDate(rental.startDate)}
            {rental.endDate && ` · Contract end ${formatDate(rental.endDate)} (auto-renews)`}
          </p>
          <p className="text-sm text-slate-500">
            Rate: {formatCurrency(rental.printer?.price ?? rental.ratePerPeriod)} /{" "}
            {rental.paymentSchedule.toLowerCase().replace("ly", "")}
          </p>
        </div>
        {billingClient.unitCount > 0 && (
          <GenerateBillingModal
            clients={[billingClient]}
            defaultClientId={billingClient.id}
          />
        )}
      </div>

      <Card>
        <CardTitle>Annual payments</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          January–December for the selected year. Contracts auto-renew each year unless
          completed or cancelled.
        </p>
        <div className="mt-4">
          <RentalAnnualPayments rental={rentalData} initialYear={initialYear} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Record payment</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Record payments against any month in the selected year above.
          </p>
          <div className="mt-4">
            <PaymentForm target={{ type: "rental", id }} />
          </div>
        </Card>

        <Card>
          <CardTitle>Status</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Use <strong>Paused</strong> when a school stops billing over vacation; set back to{" "}
            <strong>Active</strong> when classes resume.
          </p>
          <form action={setStatus} className="mt-4 flex gap-2">
            <Select name="status" defaultValue={rental.status} className="flex-1">
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused (vacation break)</option>
              <option value="COMPLETED">Completed (returned)</option>
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
        </Card>
      </div>

      <Card>
        <CardTitle>Billing pause periods</CardTitle>
        <div className="mt-4">
          <RentalPausePeriodsCard
            rentalId={rental.id}
            pausePeriods={rental.pausePeriods.map((pp) => ({
              id: pp.id,
              pausedAt: pp.pausedAt.toISOString(),
              resumedAt: pp.resumedAt?.toISOString() ?? null,
            }))}
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Rental audit log</CardTitle>
        <form action={addNote} className="mt-4 flex gap-2">
          <Input
            name="note"
            placeholder="Add note (e.g. paused for summer 2026)..."
            className="flex-1"
            required
          />
          <Button type="submit" variant="secondary">
            Add note
          </Button>
        </form>
        <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto text-sm">
          {rental.auditLogs.map((log) => (
            <li key={log.id} className="border-l-2 border-brand-200 pl-3">
              <p className="font-medium">{log.message}</p>
              <p className="text-xs text-slate-500">
                {log.action.replace("_", " ")} · {formatDateTime(log.createdAt)}
                {log.userEmail && ` · ${log.userEmail}`}
              </p>
            </li>
          ))}
          {rental.auditLogs.length === 0 && (
            <li className="text-slate-500">No audit entries yet.</li>
          )}
        </ul>
      </Card>

      <Card>
        <CardTitle>All payment records</CardTitle>
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
            <li className="py-4 text-slate-500">No payments recorded yet</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
