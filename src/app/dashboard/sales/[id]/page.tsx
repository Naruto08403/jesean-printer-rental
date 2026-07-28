import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { PaymentForm } from "@/components/payment-form";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      client: true,
      payments: { orderBy: { paidAt: "desc" } },
      lines: { orderBy: { name: "asc" } },
    },
  });
  if (!sale) notFound();

  const summary = summarizePayments(sale.totalAmount, sale.payments);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/sales" className="text-sm text-brand-600 hover:underline">
        ← Sales
      </Link>
      <h1 className="text-2xl font-bold">Sale</h1>
      <PaymentStatus summary={summary} />

      <Card>
        <CardTitle>Items</CardTitle>
        {sale.lines.length > 0 ? (
          <ul className="mt-4 divide-y text-sm">
            {sale.lines.map((line) => (
              <li key={line.id} className="flex justify-between gap-4 py-3">
                <span>
                  {line.name}
                  {line.qty > 1 ? ` × ${line.qty}` : ""}
                </span>
                <span>{formatCurrency(line.lineTotal)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-600">{sale.items}</p>
        )}
        <p className="mt-4 border-t pt-3 text-right font-medium">
          Total {formatCurrency(sale.totalAmount)}
        </p>
      </Card>

      <Card>
        <CardTitle>Record payment</CardTitle>
        <div className="mt-4">
          <PaymentForm target={{ type: "sale", id }} />
        </div>
      </Card>

      <Card>
        <CardTitle>Payments</CardTitle>
        <ul className="mt-4 divide-y text-sm">
          {sale.payments.map((p) => (
            <li key={p.id} className="flex justify-between py-3">
              <span>{formatDate(p.paidAt)}</span>
              <span>{formatCurrency(p.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
