import { PrismaClient } from "@prisma/client";
import { buildClientAnnualRows } from "../src/lib/rental-annual.ts";

const prisma = new PrismaClient();

const client = await prisma.client.findFirst({
  where: { name: { contains: "Buhangin", mode: "insensitive" } },
});
if (!client) {
  console.log("Client not found");
  process.exit(1);
}

console.log("Client:", client.id, client.name);

const rentals = await prisma.rental.findMany({
  where: { clientId: client.id },
  include: { payments: true, printer: true, pausePeriods: true, client: true },
});

console.log("Total payments:", rentals.reduce((s, r) => s + r.payments.length, 0));
for (const p of rentals.flatMap((r) => r.payments)) {
  console.log(" payment", {
    id: p.id.slice(-8),
    amount: p.amount,
    billingYear: p.billingYear,
    billingMonth: p.billingMonth,
    paidAt: p.paidAt.toISOString().slice(0, 10),
    batchId: p.batchId?.slice(-8),
  });
}

for (const year of [2025, 2026]) {
  const rentalLikes = rentals.map((r) => ({
    id: r.id,
    status: r.status,
    startDate: r.startDate,
    endDate: r.endDate,
    ratePerPeriod: r.ratePerPeriod,
    paymentSchedule: r.paymentSchedule,
    client: r.client,
    printer: r.printer,
    pausePeriods: r.pausePeriods,
    payments: r.payments.map((p) => ({
      amount: p.amount,
      paidAt: p.paidAt,
      billingYear: p.billingYear,
      billingMonth: p.billingMonth,
    })),
  }));
  const rows = buildClientAnnualRows(rentalLikes, year);
  const row = rows.find((r) => r.clientId === client.id);
  if (!row) continue;
  console.log(`\nYear ${year}:`);
  for (let m = 0; m < 12; m++) {
    const cell = row.months[m];
    if (cell.paid > 0 || cell.state === "expected" || cell.state === "partial") {
      console.log(`  ${cell.label}: paid=${cell.paid} expected=${cell.expected} state=${cell.state}`);
    }
  }
}

await prisma.$disconnect();
