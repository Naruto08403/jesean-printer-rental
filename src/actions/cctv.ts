"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { ServiceStatus } from "@prisma/client";

export async function createCctv(formData: FormData) {
  await requireAdmin();
  const clientId = String(formData.get("clientId"));
  const siteAddress = String(formData.get("siteAddress") || "").trim() || null;
  const description = String(formData.get("description") || "").trim() || null;
  const totalAmount = Number(formData.get("totalAmount"));

  await prisma.cctvInstallation.create({
    data: { clientId, siteAddress, description, totalAmount },
  });

  revalidatePath("/dashboard/cctv");
}

export async function updateCctvStatus(id: string, status: ServiceStatus) {
  await requireAdmin();
  await prisma.cctvInstallation.update({
    where: { id },
    data: {
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
    },
  });
  revalidatePath(`/dashboard/cctv/${id}`);
}
