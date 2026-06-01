import { PrismaClient } from "@prisma/client";

async function main() {
  const prisma = new PrismaClient();
  const rows = await prisma.repair.findMany({
    where: { OR: [{ problem: "" }, { problem: "Repair" }] },
  });

  for (const r of rows) {
    await prisma.repair.update({
      where: { id: r.id },
      data: {
        problem: r.title || r.description || "Repair",
        receivedAt: r.receivedAt ?? r.createdAt,
      },
    });
  }

  console.log("Backfilled", rows.length, "repairs");
  await prisma.$disconnect();
}

main();
