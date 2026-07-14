/**
 * Snapshot diagnosis line prices for repairs created before RepairDiagnosisLine existed.
 * Run: npx tsx scripts/backfill-repair-diagnosis-lines.ts
 */
import { PrismaClient } from "@prisma/client";
import { resolveRepairPricing } from "../src/lib/repair-pricing";

const prisma = new PrismaClient();

async function main() {
  const repairs = await prisma.repair.findMany({
    where: {
      diagnosisLines: { none: {} },
      isChargeWaived: false,
    },
    select: {
      id: true,
      diagnosis: true,
      totalAmount: true,
      pricingMode: true,
    },
  });

  if (repairs.length === 0) {
    console.log("No repairs need backfill.");
    return;
  }

  let updated = 0;
  for (const repair of repairs) {
    const pricingMode = repair.pricingMode;
    const generalPrice =
      pricingMode === "GENERAL" ? repair.totalAmount : null;

    const pricing = await resolveRepairPricing({
      diagnosisRaw: repair.diagnosis,
      chargeWaived: false,
      pricingMode,
      generalPrice,
    });

    if (pricing.lines.length === 0) continue;

    await prisma.$transaction([
      prisma.repairDiagnosisLine.deleteMany({ where: { repairId: repair.id } }),
      prisma.repairDiagnosisLine.createMany({
        data: pricing.lines.map((line, index) => ({
          repairId: repair.id,
          name: line.name,
          price: line.price,
          sortOrder: index,
        })),
      }),
    ]);

    updated += 1;
  }

  console.log(`Backfilled diagnosis lines for ${updated} repair(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
