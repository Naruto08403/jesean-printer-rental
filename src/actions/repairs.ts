"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin, auth } from "@/lib/auth";
import { logPrinterAudit } from "@/lib/audit";
import type { ServiceStatus } from "@prisma/client";

export async function createRepair(formData: FormData) {
  await requireAdmin();
  const session = await auth();
  const clientId = String(formData.get("clientId"));
  const printerId = String(formData.get("printerId") || "") || null;
  const title = String(formData.get("title"));
  const description = String(formData.get("description") || "").trim() || null;
  const totalAmount = Number(formData.get("totalAmount"));

  const repair = await prisma.repair.create({
    data: { clientId, printerId, title, description, totalAmount },
  });

  if (printerId) {
    await prisma.printer.update({
      where: { id: printerId },
      data: { status: "IN_REPAIR" },
    });
    await logPrinterAudit(printerId, "REPAIR_LINKED", `Repair opened: ${title}`, {
      userEmail: session?.user?.email,
      metadata: { repairId: repair.id },
    });
  }

  revalidatePath("/dashboard/repairs");
  revalidatePath("/dashboard/printers");
}

export async function updateRepairStatus(id: string, status: ServiceStatus) {
  await requireAdmin();
  const session = await auth();
  const repair = await prisma.repair.update({
    where: { id },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
    include: { printer: true },
  });

  if (repair.printerId && status === "COMPLETED") {
    const activeRental = await prisma.rental.findFirst({
      where: { printerId: repair.printerId, status: "ACTIVE" },
    });
    await prisma.printer.update({
      where: { id: repair.printerId },
      data: { status: activeRental ? "RENTED" : "AVAILABLE" },
    });
    await logPrinterAudit(
      repair.printerId,
      "STATUS_CHANGED",
      "Repair completed",
      { userEmail: session?.user?.email, metadata: { repairId: id } }
    );
  }

  revalidatePath(`/dashboard/repairs/${id}`);
}
