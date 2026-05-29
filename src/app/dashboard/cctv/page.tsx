import { prisma } from "@/lib/prisma";
import { createCctv } from "@/actions/cctv";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency } from "@/lib/utils";

export default async function CctvPage() {
  const [jobs, clients] = await Promise.all([
    prisma.cctvInstallation.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, payments: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">CCTV installations</h1>

      <Card>
        <CardTitle>New installation</CardTitle>
        <form action={createCctv} className="mt-4 grid gap-3 sm:grid-cols-2">
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
            <Label>Total (PHP) *</Label>
            <Input name="totalAmount" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Site address</Label>
            <Input name="siteAddress" />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input name="description" />
          </div>
          <Button type="submit">Create job</Button>
        </form>
      </Card>

      <Card>
        <CardTitle>Installations</CardTitle>
        <div className="mt-4 space-y-3">
          {jobs.map((j) => {
            const summary = summarizePayments(j.totalAmount, j.payments);
            return (
              <Link
                key={j.id}
                href={`/dashboard/cctv/${j.id}`}
                className="block rounded-lg border p-4 hover:bg-slate-50"
              >
                <p className="font-semibold">{j.client.name}</p>
                <p className="text-sm text-slate-500">
                  {j.status} · {formatCurrency(j.totalAmount)}
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
