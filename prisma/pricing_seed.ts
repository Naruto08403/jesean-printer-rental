import { PrismaClient } from "@prisma/client";
import { printerPricing } from "./data/printerPricing";

const prisma = new PrismaClient();

async function main() {
  for (const printer of printerPricing) {
    const brand = await prisma.printerBrand.upsert({
      where: {
        name: printer.brand,
      },
      update: {},
      create: {
        name: printer.brand,
      },
    });

    const model = await prisma.printerModel.upsert({
      where: {
        brandId_name: {
          brandId: brand.id,
          name: printer.model,
        },
      },
      update: {},
      create: {
        name: printer.model,
        brandId: brand.id,
      },
    });

    for (const repair of printer.repairs) {
      await prisma.repairPricing.create({
        data: {
          printerModelId: model.id,
          repairName: repair.name,
          laborCost: repair.labor,
          partsCost: repair.parts,
        },
      });
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });