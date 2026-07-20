import { auth } from "@/lib/auth";
import { getPortalClientData, printerLabel } from "@/lib/portal-data";
import { repairDisplayTitle } from "@/lib/repair-device";
import { redirect } from "next/navigation";
import {
  PortalPaymentTimeline,
  type PortalPaymentItem,
} from "@/components/portal/portal-payment-timeline";
import { formatCurrency } from "@/lib/utils";

export default async function PortalPaymentsPage() {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const data = await getPortalClientData(clientId);
  if (!data) redirect("/portal/login");

  const payments: PortalPaymentItem[] = [];

  for (const rental of data.rentals) {
    for (const p of rental.payments) {
      payments.push({
        id: p.id,
        amount: p.amount,
        paidAt: p.paidAt,
        method: p.method,
        reference: p.reference,
        type: "Rental",
        label: printerLabel(rental.printer),
      });
    }
  }
  for (const repair of data.repairs) {
    for (const p of repair.payments) {
      payments.push({
        id: p.id,
        amount: p.amount,
        paidAt: p.paidAt,
        method: p.method,
        reference: p.reference,
        type: "Repair",
        label: repairDisplayTitle(repair),
      });
    }
  }
  for (const sale of data.sales) {
    for (const p of sale.payments) {
      payments.push({
        id: p.id,
        amount: p.amount,
        paidAt: p.paidAt,
        method: p.method,
        reference: p.reference,
        type: "Purchase",
        label: sale.items,
      });
    }
  }
  // for (const job of data.cctvJobs) {
  //   for (const p of job.payments) {
  //     payments.push({
  //       id: p.id,
  //       amount: p.amount,
  //       paidAt: p.paidAt,
  //       method: p.method,
  //       reference: p.reference,
  //       type: "CCTV",
  //       label: job.siteAddress ?? "CCTV installation",
  //     });
  //   }
  // }

  payments.sort((a, b) => b.paidAt.getTime() - a.paidAt.getTime());
  const lifetimeTotal = payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payment history</h1>
          <p className="mt-1 text-slate-500">
            All payments across rentals, repairs, purchases, and CCTV
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-right">
          <p className="text-xs font-medium uppercase text-emerald-700">Lifetime paid</p>
          <p className="text-2xl font-bold text-emerald-800">{formatCurrency(lifetimeTotal)}</p>
        </div>
      </div>

      <PortalPaymentTimeline payments={payments} />
    </div>
  );
}
