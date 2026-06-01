import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

async function main() {
  const prisma = new PrismaClient();
  const payments = await prisma.payment.findMany({
    where: { rentalId: { not: null } },
  });

  const clusterKey = (p: (typeof payments)[0]) =>
    `${p.reference ?? ""}|${p.notes ?? ""}|${p.method ?? ""}|${Math.floor(p.createdAt.getTime() / 5000)}`;

  const batchByCluster = new Map<string, string>();

  for (const p of payments) {
    const year = p.billingYear ?? new Date(p.paidAt).getFullYear();
    const month = p.billingMonth ?? new Date(p.paidAt).getMonth();
    let batchId = p.batchId;
    if (!batchId) {
      const key = clusterKey(p);
      batchId = batchByCluster.get(key) ?? randomUUID();
      batchByCluster.set(key, batchId);
    }
    await prisma.payment.update({
      where: { id: p.id },
      data: {
        billingYear: year,
        billingMonth: month,
        batchId,
      },
    });
  }

  console.log("Backfilled", payments.length, "rental payments");
  await prisma.$disconnect();
}

main();
