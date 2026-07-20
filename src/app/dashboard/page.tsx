import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/stat-card";
import { Card, CardTitle } from "@/components/ui/card";
import { Users, KeyRound, Wrench, AlertCircle } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { summarizePayments, rentalExpectedTotal } from "@/lib/payments";

export default async function DashboardPage() {
  const [clients, activeRentals, openRepairs, recentPayments] = await Promise.all([
    prisma.client.count(),
    prisma.rental.count({ where: { status: "ACTIVE" } }),
    prisma.repair.count({
      where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
    }),
    prisma.payment.findMany({
      take: 8,
      orderBy: { paidAt: "desc" },
      include: {
        rental: { include: { client: true } },
        repair: { include: { client: true } },
        sale: { include: { client: true } },
        cctvInstallation: {  },
      },
    }),
  ]);

  const rentalsWithBalance = await prisma.rental.findMany({
    where: { status: "ACTIVE" },
    include: { payments: true, client: true },
    take: 5,
  });

  // const overdue = rentalsWithBalance.filter((r) => {
  //   const total = rentalExpectedTotal(r);
  //   const s = summarizePayments(total, r.payments);
  //   return !s.isFullyPaid;
  // });

  const rentals = await prisma.rental.findMany({
    where: { status: "ACTIVE" },
    include: {
      payments: true,
      client: true,
    },
  });
  
  const overdue = rentals.filter((r) => {
    const total = rentalExpectedTotal(r);
    const s = summarizePayments(total, r.payments);
    return !s.isFullyPaid;
  });
  const overdueRentals = rentals.filter((r) => {
    const total = rentalExpectedTotal(r);
    const s = summarizePayments(total, r.payments);
    return !s.isFullyPaid;
  });
  const clientsWithBalance = Array.from(
    new Map(
      overdueRentals.map((r) => [r.clientId, r.client])
    ).values()
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Overview of your business</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Clients" value={clients} icon={Users} />
        <StatCard title="Active rentals" value={activeRentals} icon={KeyRound} />
        <StatCard title="Open repairs" value={openRepairs} icon={Wrench} />
        <StatCard
          title="Rental Clients with balance"
          value={clientsWithBalance.length}
          subtitle="Clients with unpaid rentals"
          icon={AlertCircle}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Recent payments</CardTitle>
          <ul className="mt-4 divide-y divide-slate-100">
            {recentPayments.length === 0 && (
              <li className="py-4 text-sm text-slate-500">No payments yet</li>
            )}
            {recentPayments.map((p) => {
              const label =
                p.rental?.client.name ??
                p.repair?.client?.name ??
                p.repair?.customerName ??
                p.sale?.client?.name ??
                p.cctvInstallation?.clientName ??
                "—";
              const type = p.rentalId
                ? "Rental"
                : p.repairId
                  ? "Repair"
                  : p.saleId
                    ? "Sale"
                    : "CCTV";
              return (
                <li key={p.id} className="flex justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-slate-500">
                      {type} · {formatDate(p.paidAt)}
                    </p>
                  </div>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(p.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardTitle>Active rentals — payment status</CardTitle>
          <ul className="mt-4 space-y-3">
            {rentalsWithBalance.map((r) => {
              const total = rentalExpectedTotal(r);
              const s = summarizePayments(total, r.payments);
              return (
                <li key={r.id}>
                  <Link
                    href={`/dashboard/rentals/${r.id}`}
                    className="block rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
                  >
                    <p className="font-medium">{r.client.name}</p>
                    <p className="text-sm text-slate-500">
                      {formatCurrency(s.paid)} / {formatCurrency(s.total)} ·{" "}
                      {r.paymentSchedule.toLowerCase()}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
