import { prisma } from "@/lib/prisma";
import type { BillingRentalUnit } from "@/lib/rental-billing-shared";

export async function loadClientBillingRentals(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      rentals: {
        where: { status: { in: ["ACTIVE", "PAUSED"] } },
        include: { printer: true },
      },
    },
  });

  if (!client) return null;

  const rentals: BillingRentalUnit[] = client.rentals.map((r) => ({
    status: r.status,
    ratePerPeriod: r.ratePerPeriod,
    paymentSchedule: r.paymentSchedule,
    printer: r.printer
      ? {
          brand: r.printer.brand,
          model: r.printer.model,
          status: r.printer.status,
          price: r.printer.price,
        }
      : null,
  }));

  return { client, rentals };
}
