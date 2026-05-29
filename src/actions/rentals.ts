"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, auth } from "@/lib/auth";
import { logPrinterAudit } from "@/lib/audit";
import type { PaymentSchedule, RentalStatus } from "@prisma/client";

export async function createRental(formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const clientId = String(formData.get("clientId"));
  const printerId = String(formData.get("printerId") || "") || null;
  const startDate = new Date(String(formData.get("startDate")));
  const endDate = formData.get("endDate")
    ? new Date(String(formData.get("endDate")))
    : null;
  const ratePerPeriod = Number(formData.get("ratePerPeriod"));
  const totalContract = formData.get("totalContract")
    ? Number(formData.get("totalContract"))
    : null;
  const paymentSchedule = formData.get("paymentSchedule") as PaymentSchedule;
  const description = String(formData.get("description") || "").trim() || null;

  const rental = await prisma.rental.create({
    data: {
      clientId,
      printerId,
      startDate,
      endDate,
      ratePerPeriod,
      totalContract,
      paymentSchedule,
      description,
    },
  });

  if (printerId) {
    await prisma.printer.update({
      where: { id: printerId },
      data: { status: "RENTED" },
    });
    await logPrinterAudit(printerId, "RENTAL_LINKED", `Rental started for client`, {
      userEmail: session?.user?.email,
      metadata: { rentalId: rental.id, clientId },
    });
  }

  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/printers");
}

export async function updateRentalStatus(id: string, status: RentalStatus) {
  await requireAdmin();
  const session = await auth();
  const rental = await prisma.rental.update({
    where: { id },
    data: { status },
    include: { printer: true },
  });

  if (rental.printerId && status === "COMPLETED") {
    await prisma.printer.update({
      where: { id: rental.printerId },
      data: { status: "AVAILABLE" },
    });
    await logPrinterAudit(
      rental.printerId,
      "STATUS_CHANGED",
      "Printer returned — rental completed",
      { userEmail: session?.user?.email, metadata: { rentalId: id } }
    );
  }

  revalidatePath(`/dashboard/rentals/${id}`);
  revalidatePath("/dashboard/rentals");
}
