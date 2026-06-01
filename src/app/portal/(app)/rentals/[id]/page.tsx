import Link from "next/link";
import { auth } from "@/lib/auth";
import { getPortalClientData, printerLabel, rentalToAnnualRow } from "@/lib/portal-data";
import { redirect, notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { PortalBillingGrid } from "@/components/portal/portal-billing-grid";
import { PortalRentalBalanceStatus } from "@/components/portal/portal-rental-balance";
import { getPortalRentalBalance } from "@/lib/portal-rental-balance";
import { defaultRentalAnnualYear, rentalAnnualYearOptions } from "@/lib/rental-annual";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { RentalStatus } from "@prisma/client";
import { ArrowLeft, Cpu, Hash, Calendar } from "lucide-react";

const statusColor: Record<RentalStatus, "green" | "amber" | "slate" | "red"> = {
  ACTIVE: "green",
  PAUSED: "amber",
  COMPLETED: "slate",
  CANCELLED: "red",
};

export default async function PortalRentalDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const { id } = await params;
  const { year: yearParam } = await searchParams;
  const year = yearParam
    ? parseInt(yearParam, 10)
    : defaultRentalAnnualYear();

  const data = await getPortalClientData(clientId);
  if (!data) redirect("/portal/login");

  const rental = data.rentals.find((r) => r.id === id);
  if (!rental) notFound();

  const annualRow = rentalToAnnualRow(rental, year);
  const balance = getPortalRentalBalance(rental, year);
  const years = rentalAnnualYearOptions();
  const monthlyRate = rental.printer?.price ?? rental.ratePerPeriod;
  const name = printerLabel(rental.printer);

  return (
    <div className="space-y-6">
      <Link
        href="/portal/rentals"
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to rentals
      </Link>

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-brand-600 to-brand-800 px-6 py-6 text-white sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-brand-100">Printer rental</p>
              <h1 className="mt-1 text-2xl font-bold">{name}</h1>
              {rental.printer?.serialNumber && (
                <p className="mt-1 text-sm text-brand-100/80">SN: {rental.printer.serialNumber}</p>
              )}
            </div>
            <Badge color={statusColor[rental.status]}>
              {rental.status.replace("_", " ")}
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 p-6 sm:grid-cols-3 sm:p-8">
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <Calendar className="mt-0.5 h-5 w-5 text-brand-600" />
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Started</p>
              <p className="font-semibold text-slate-900">{formatDate(rental.startDate)}</p>
              {rental.endDate && (
                <p className="text-xs text-slate-500">Ends {formatDate(rental.endDate)}</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
            <Cpu className="mt-0.5 h-5 w-5 text-brand-600" />
            <div>
              <p className="text-xs font-medium uppercase text-slate-500">Rate</p>
              <p className="font-semibold text-slate-900">
                {formatCurrency(monthlyRate)} / month
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 sm:col-span-3">
            <div className="w-full">
              <p className="text-xs font-medium uppercase text-slate-500">Balance</p>
              <div className="mt-1">
                <PortalRentalBalanceStatus balance={balance} />
              </div>
            </div>
          </div>
          {rental.printer && (
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4">
              <Hash className="mt-0.5 h-5 w-5 text-brand-600" />
              <div>
                <p className="text-xs font-medium uppercase text-slate-500">Equipment</p>
                <p className="font-semibold text-slate-900">
                  {[rental.printer.brand, rental.printer.model].filter(Boolean).join(" ") || "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Monthly billing</h2>
          <div className="flex flex-wrap gap-2">
            {years.map((y) => (
              <Link
                key={y}
                href={`/portal/rentals/${id}?year=${y}`}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  y === year
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>
        <PortalBillingGrid
          annualRow={annualRow}
          rentalStatus={rental.status}
          year={year}
          startDate={rental.startDate}
        />
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Payment history</h2>
        <ul className="mt-4 divide-y divide-slate-100">
          {rental.payments.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-3 text-sm">
              <div>
                <p className="font-medium text-slate-900">{formatDate(p.paidAt)}</p>
                <p className="text-xs text-slate-500">
                  {[p.method, p.reference && `OR# ${p.reference}`].filter(Boolean).join(" · ") ||
                    "Payment recorded"}
                </p>
              </div>
              <span className="font-semibold text-emerald-700">{formatCurrency(p.amount)}</span>
            </li>
          ))}
          {rental.payments.length === 0 && (
            <li className="py-8 text-center text-sm text-slate-500">No payments recorded yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
