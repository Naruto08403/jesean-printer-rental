import { prisma } from "@/lib/prisma";
import { createSale } from "@/actions/sales";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency } from "@/lib/utils";

export default async function SalesPage() {
  const [sales, clients] = await Promise.all([
    prisma.sale.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, payments: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sales (inks & supplies)</h1>

      <Card>
        <CardTitle>New sale</CardTitle>
        <form action={createSale} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Client</Label>
            <Select name="clientId">
              <option value="">Walk-in</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Total (PHP) *</Label>
            <Input name="totalAmount" type="number" step="0.01" required />
          </div>
          <div className="sm:col-span-2">
            <Label>Items (description or JSON)</Label>
            <Input name="items" placeholder='e.g. HP 803 Black Ink x2' required />
          </div>
          <Button type="submit">Record sale</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Sales list</CardTitle>
        <div className="mt-4 space-y-3">
          {sales.map((s) => {
            const summary = summarizePayments(s.totalAmount, s.payments);
            let itemsLabel = s.items;
            try {
              const parsed = JSON.parse(s.items) as { name: string }[];
              itemsLabel = parsed.map((i) => i.name).join(", ");
            } catch {
              /* plain text */
            }
            return (
              <Link
                key={s.id}
                href={`/dashboard/sales/${s.id}`}
                className="block rounded-lg border p-4 hover:bg-slate-50"
              >
                <p className="font-medium">{itemsLabel}</p>
                <p className="text-sm text-slate-500">
                  {s.client?.name ?? "Walk-in"} · {formatCurrency(s.totalAmount)}
                </p>
                <PaymentStatus summary={summary} />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
