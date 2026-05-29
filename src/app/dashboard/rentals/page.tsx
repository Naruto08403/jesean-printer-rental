import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AddRentalModal } from "@/components/forms/add-rental-modal";
import { ImportRentalsModal } from "@/components/forms/import-rentals-modal";
import { RentalsAnnualView } from "@/components/rentals-annual-view";

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

  const clientOptions = clients.map((c) => ({ id: c.id, label: c.name }));
  const printerOptions = printers.map((p) => ({
    id: p.id,
    label: [p.brand, p.model, p.serialNumber].filter(Boolean).join(" "),
  }));

  const rentalData = rentals.map((r) => ({
    id: r.id,
    status: r.status,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    ratePerPeriod: r.ratePerPeriod,
    paymentSchedule: r.paymentSchedule,
    client: { id: r.client.id, name: r.client.name },
    printer: r.printer
      ? {
          brand: r.printer.brand,
          model: r.printer.model,
          serialNumber: r.printer.serialNumber,
        }
      : null,
    payments: r.payments.map((p) => ({
      amount: p.amount,
      paidAt: p.paidAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Printer rentals" subtitle={`${rentals.length} total · annual view`}>
        <ImportRentalsModal />
        <AddRentalModal clients={clientOptions} printers={printerOptions} />
      </PageHeader>

      <RentalsAnnualView rentals={rentalData} />
    </div>
  );
}
