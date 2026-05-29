import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { PaymentStatus } from "@/components/payment-status";
import { rentalExpectedTotal, summarizePayments } from "@/lib/payments";
import { formatDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function PortalRentalsPage() {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const rentals = await prisma.rental.findMany({
    where: { clientId },
    orderBy: { startDate: "desc" },
    include: { payments: true, printer: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Your rentals</h1>
      <div className="space-y-4">
        {rentals.map((r) => {
          const total = rentalExpectedTotal(r);
          const summary = summarizePayments(total, r.payments);
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">
                  {r.printer
                    ? `${r.printer.brand ?? ""} ${r.printer.model ?? ""}`.trim() || "Printer"
                    : "Rental"}
                </CardTitle>
                <Badge
                  color={
                    r.status === "ACTIVE" ? "green" : r.status === "PAUSED" ? "amber" : "slate"
                  }
                >
                  {r.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                {formatDate(r.startDate)}
                {r.endDate && ` – ${formatDate(r.endDate)}`} · {r.paymentSchedule.toLowerCase()}
              </p>
              <div className="mt-3">
                <PaymentStatus summary={summary} />
              </div>
            </Card>
          );
        })}
        {rentals.length === 0 && (
          <p className="text-slate-500">No rental history on your account.</p>
        )}
      </div>
    </div>
  );
}
