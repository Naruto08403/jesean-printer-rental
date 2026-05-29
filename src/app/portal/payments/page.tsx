import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

export default async function PortalPaymentsPage() {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/login");

  const [rentals, repairs, sales, cctv] = await Promise.all([
    prisma.rental.findMany({
      where: { clientId },
      select: { id: true },
    }),
    prisma.repair.findMany({
      where: { clientId },
      select: { id: true },
    }),
    prisma.sale.findMany({
      where: { clientId },
      select: { id: true },
    }),
    prisma.cctvInstallation.findMany({
      where: { clientId },
      select: { id: true },
    }),
  ]);

  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        { rentalId: { in: rentals.map((r) => r.id) } },
        { repairId: { in: repairs.map((r) => r.id) } },
        { saleId: { in: sales.map((s) => s.id) } },
        { cctvInstallationId: { in: cctv.map((c) => c.id) } },
      ],
    },
    orderBy: { paidAt: "desc" },
    include: {
      rental: true,
      repair: true,
      sale: true,
      cctvInstallation: true,
    },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Payment history</h1>
      <Card>
        <CardTitle>All payments</CardTitle>
        <ul className="mt-4 divide-y text-sm">
          {payments.map((p) => {
            const type = p.rentalId
              ? "Rental"
              : p.repairId
                ? "Repair"
                : p.saleId
                  ? "Sale"
                  : "CCTV";
            return (
              <li key={p.id} className="flex justify-between py-3">
                <div>
                  <p className="font-medium">{type}</p>
                  <p className="text-slate-500">{formatDate(p.paidAt)}</p>
                </div>
                <span className="font-semibold text-emerald-700">
                  {formatCurrency(p.amount)}
                </span>
              </li>
            );
          })}
          {payments.length === 0 && (
            <li className="py-4 text-slate-500">No payments on record yet</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
