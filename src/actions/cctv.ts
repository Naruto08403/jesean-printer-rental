"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { ServiceStatus } from "@prisma/client";
import { formatDate } from "@/lib/utils";

export async function createCctv(formData: FormData) {
  await requireAdmin();
    const clientName = String(formData.get("clientName"));
    const siteAddress = String(formData.get("siteAddress") || "").trim() || null;
    const description = String(formData.get("description") || "").trim() || null;
    const totalAmount = Number(formData.get("totalAmount"));
    const dateStarted = new Date(String(formData.get("dateStarted")));
  await prisma.cctvInstallation.create({
    data: {
      clientName,
      siteAddress,
      description,
      totalAmount,
      dateStarted: new Date(dateStarted),
    },
  });

  revalidatePath("/dashboard/cctv");
}
export async function updateCctvStatus(
  id: string,
  status: ServiceStatus,
  totalAmount: number,
  dateStarted: Date | null,
  completedAt: Date | null,
  siteAddress: string,
  description: string
) {
  await prisma.cctvInstallation.update({
    where: { id },
    data: {
      status,
      totalAmount,
      dateStarted,
      completedAt,
      siteAddress,
      description,
    },
  });


  revalidatePath("/dashboard/cctv");
  revalidatePath(`/dashboard/cctv/${id}`);
}

export async function deleteCctv(id: string) {
  await prisma.cctvInstallation.delete({
    where: { id },
  });

  revalidatePath("/dashboard/cctv");
}
