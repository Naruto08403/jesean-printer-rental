import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.VISIT_STAFF_EMAIL ?? "visitstaff@jeseanrentals.local";
  const password = process.env.VISIT_STAFF_PASSWORD ?? "visit123";

  const existing = await prisma.user.findUnique({
    where: { email },
  });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: "Visit Staff",
        role: "VISIT_STAFF",
      },
    });

    console.log(`Visit Staff created: ${email}`);
  } else {
    console.log("Visit Staff already exists");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });