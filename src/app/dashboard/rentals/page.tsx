import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/page-header";
import { AddRentalModal } from "@/components/forms/add-rental-modal";
import { AddRentalPaymentModal } from "@/components/forms/add-rental-payment-modal";
import { ImportRentalsModal } from "@/components/forms/import-rentals-modal";
import { RentalPaymentRecordsModal } from "@/components/rental-payment-records-modal";
import { RentalsAnnualView } from "@/components/rentals-annual-view";
import { GenerateBillingModal } from "@/components/forms/generate-billing-modal";
import { ManageClientPauseModal } from "@/components/forms/manage-client-pause-modal";
import { getClientPaymentSuggestion } from "@/lib/rental-annual";
import { formatPausePeriodRange, pausePeriodKey } from "@/lib/rental-pause";
import { ExportRentalsButton } from "@/components/export-rental-button";
export default async function RentalsPage() {
  const [rentals, clients, printers] = await Promise.all([
    prisma.rental.findMany({
      orderBy: { createdAt: "desc" },
      include: { client: true, printer: true, payments: true, pausePeriods: true },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" } }),
    prisma.printer.findMany({
      where: { status: { in: ["AVAILABLE", "RENTED"] }, type: "RENTAL" },
      orderBy: { brand: "asc" },
    }),
  ]);

  const clientIdsWithRentals = new Set(rentals.map((r) => r.clientId));
  const rentalsByClient = new Map<string, typeof rentals>();
  for (const rental of rentals) {
    const list = rentalsByClient.get(rental.clientId) ?? [];
    list.push(rental);
    rentalsByClient.set(rental.clientId, list);
  }

  // const clientOptions = clients
  //   .filter((c) => clientIdsWithRentals.has(c.id))
  //   .map((c) => {
  //     const clientRentals = rentalsByClient.get(c.id) ?? [];
  //     const suggestion = getClientPaymentSuggestion(clientRentals);
  //     return {
  //       id: c.id,
  //       label: c.name,
  //       monthlyPayable: suggestion?.monthlyPayable ?? 0,
  //       suggestedAmount: suggestion?.suggestedAmount ?? 0,
  //       unitCount: suggestion?.unitCount ?? 0,
  //     };
  //   });
  
    const clientOptions = clients.map((c) => {
      const clientRentals = rentalsByClient.get(c.id) ?? [];
      const suggestion = getClientPaymentSuggestion(clientRentals);
    
      return {
        id: c.id,
        label: c.name,
        monthlyPayable: suggestion?.monthlyPayable ?? 0,
        suggestedAmount: suggestion?.suggestedAmount ?? 0,
        unitCount: suggestion?.unitCount ?? 0,
      };
    });
  const printerOptions = printers.map((p) => ({
    id: p.id,
    label: [p.brand, p.model, p.serialNumber].filter(Boolean).join(" "),
  }));

  const pauseGroupsByClient: Record<
    string,
    { key: string; label: string; ids: string[] }[]
  > = {};
  for (const rental of rentals) {
    for (const period of rental.pausePeriods) {
      const key = pausePeriodKey(period.pausedAt, period.resumedAt);
      const groups = pauseGroupsByClient[rental.clientId] ?? [];
      let group = groups.find((g) => g.key === key);
      if (!group) {
        group = {
          key,
          label: formatPausePeriodRange(period.pausedAt, period.resumedAt),
          ids: [],
        };
        groups.push(group);
      }
      group.ids.push(period.id);
      pauseGroupsByClient[rental.clientId] = groups;
    }
  }
  for (const clientId of Object.keys(pauseGroupsByClient)) {
    pauseGroupsByClient[clientId].sort((a, b) => a.label.localeCompare(b.label));
  }

  const rentalData = rentals.map((r) => ({
    id: r.id,
    status: r.status,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    ratePerPeriod: r.ratePerPeriod,
    paymentSchedule: r.paymentSchedule,
    client: { id: r.client.id, name: r.client.name, status: r.client.status },
    printer: r.printer
      ? {
          brand: r.printer.brand,
          model: r.printer.model,
          serialNumber: r.printer.serialNumber,
          price: r.printer.price,
          status: r.printer.status,
        }
      : null,
    payments: r.payments.map((p) => ({
      amount: p.amount,
      paidAt: p.paidAt.toISOString(),
      billingYear: p.billingYear,
      billingMonth: p.billingMonth,
    })),
    pausePeriods: r.pausePeriods.map((pp) => ({
      pausedAt: pp.pausedAt.toISOString(),
      resumedAt: pp.resumedAt?.toISOString() ?? null,
    })),
  }));

  return (
    <div className="space-y-6">
      <PageHeader title="Printer rentals" subtitle={`${rentals.length} total · annual view`}>
        <ImportRentalsModal />
        <ExportRentalsButton/>
        <RentalPaymentRecordsModal
          clients={clientOptions.map(({ id, label }) => ({ id, label }))}
        />
        <ManageClientPauseModal
          clients={clientOptions.map(({ id, label }) => ({ id, label }))}
          pauseGroupsByClient={pauseGroupsByClient}
        />
        <GenerateBillingModal
          clients={clientOptions.map(({ id, label, monthlyPayable, unitCount }) => ({
            id,
            label,
            monthlyPayable,
            unitCount,
          }))}
        />
        <AddRentalPaymentModal clients={clientOptions} />
        <AddRentalModal clients={clientOptions} printers={printerOptions} />
      </PageHeader>

      <RentalsAnnualView
        rentals={rentalData}
        billingClients={clientOptions.map(({ id, label, monthlyPayable, unitCount }) => ({
          id,
          label,
          monthlyPayable,
          unitCount,
        }))}
      />
    </div>
  );
}
