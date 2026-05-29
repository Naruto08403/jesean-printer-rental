import { prisma } from "@/lib/prisma";
import { createRental } from "@/actions/rentals";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { PaymentStatus } from "@/components/payment-status";
import { rentalExpectedTotal, summarizePayments } from "@/lib/payments";

export default async function RentalsPage() {
  const [rentals, clients, printers] = await Promise.all([
    prisma.rental.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, printer: true, payments: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.printer.findMany({
      where: { status: { in: ["AVAILABLE", "RENTED"] } },
      orderBy: { brand: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Printer rentals</h1>

      <Card>
        <CardTitle>New rental</CardTitle>
        <form action={createRental} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Client *</Label>
            <Select name="clientId" required>
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Printer</Label>
            <Select name="printerId">
              <option value="">None</option>
              {printers.map((p) => (
                <option key={p.id} value={p.id}>
                  {[p.brand, p.model, p.serialNumber].filter(Boolean).join(" ")}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Start date *</Label>
            <Input name="startDate" type="date" required />
          </div>
          <div>
            <Label>End date</Label>
            <Input name="endDate" type="date" />
          </div>
          <div>
            <Label>Rate per period (PHP) *</Label>
            <Input name="ratePerPeriod" type="number" step="0.01" required />
          </div>
          <div>
            <Label>Payment schedule *</Label>
            <Select name="paymentSchedule" defaultValue="QUARTERLY">
              <option value="MONTHLY">Monthly</option>
              <option value="QUARTERLY">Quarterly</option>
              <option value="ANNUAL">Annual</option>
            </Select>
          </div>
          <div>
            <Label>Total contract (optional)</Label>
            <Input name="totalContract" type="number" step="0.01" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Create rental</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>All rentals</CardTitle>
        <div className="mt-4 space-y-3">
          {rentals.map((r) => {
            const total = rentalExpectedTotal(r);
            const summary = summarizePayments(total, r.payments);
            return (
              <Link
                key={r.id}
                href={`/dashboard/rentals/${r.id}`}
                className="block rounded-lg border border-slate-100 p-4 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.client.name}</p>
                    <p className="text-sm text-slate-500">
                      {r.status} · {r.paymentSchedule.toLowerCase()} billing
                      {r.printer && ` · ${r.printer.brand} ${r.printer.model ?? ""}`}
                    </p>
                  </div>
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
