import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { PaymentStatus } from "@/components/payment-status";
import { rentalExpectedTotal, summarizePayments } from "@/lib/payments";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default async function PortalPage() {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      rentals: {
        where: { status: "ACTIVE" },
        include: { payments: true, printer: true },
      },
      repairs: {
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
        include: { payments: true },
        take: 5,
      },
      cctvJobs: {
        where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
        include: { payments: true },
        take: 5,
      },
    },
  });

  if (!client) redirect("/portal/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hello, {client.name}</h1>
        <p className="text-slate-500">Your account at a glance</p>
      </div>

      <Card>
        <CardTitle>Active rentals</CardTitle>
        {client.rentals.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No active rentals</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {client.rentals.map((r) => {
              const total = rentalExpectedTotal(r);
              const summary = summarizePayments(total, r.payments);
              return (
                <li key={r.id} className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">
                      {r.printer
                        ? `${r.printer.brand ?? ""} ${r.printer.model ?? ""}`.trim()
                        : "Printer rental"}
                    </p>
                    <Badge color="blue">{r.paymentSchedule.toLowerCase()}</Badge>
                  </div>
                  <div className="mt-2">
                    <PaymentStatus summary={summary} />
                  </div>
                  <Link href="/portal/rentals" className="mt-2 inline-block text-sm text-brand-600">
                    View details →
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {(client.repairs.length > 0 || client.cctvJobs.length > 0) && (
        <Card>
          <CardTitle>Open jobs</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {client.repairs.map((r) => (
              <li key={r.id}>
                Repair: {r.title} — {r.status}
              </li>
            ))}
            {client.cctvJobs.map((j) => (
              <li key={j.id}>
                CCTV: {j.siteAddress ?? "Installation"} — {j.status}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
