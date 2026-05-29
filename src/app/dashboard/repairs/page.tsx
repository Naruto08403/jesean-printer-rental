import { prisma } from "@/lib/prisma";
import { createRepair } from "@/actions/repairs";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";

export default async function RepairsPage() {
  const [repairs, clients, printers] = await Promise.all([
    prisma.repair.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, printer: true, payments: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.printer.findMany({ orderBy: { brand: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Repairs</h1>

      <Card>
        <CardTitle>New repair job</CardTitle>
        <form action={createRepair} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Client *</Label>
            <Select name="clientId" required>
              <option value="">Select</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Printer (optional)</Label>
            <Select name="printerId">
              <option value="">None</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.brand, p.model].filter(Boolean).join(" ")}
                </option>
              ))}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Title *</Label>
            <Input name="title" required />
          </div>
          <div>
            <Label>Total amount (PHP) *</Label>
            <Input name="totalAmount" type="number" step="0.01" required />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Create repair</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>All repairs</CardTitle>
        <div className="mt-4 space-y-3">
          {repairs.map((r) => {
            const summary = summarizePayments(r.totalAmount, r.payments);
            return (
              <Link
                key={r.id}
                href={`/dashboard/repairs/${r.id}`}
                className="block rounded-lg border p-4 hover:bg-slate-50"
              >
                <p className="font-semibold">{r.title}</p>
                <p className="text-sm text-slate-500">{r.client.name} · {r.status}</p>
                <div className="mt-2">
                  <PaymentStatus summary={summary} />
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
