"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import type { ServiceStatus } from "@prisma/client";

export async function createCctv(formData: FormData) {
  await requireAdmin();

  const clientId = String(formData.get("clientId"));

  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client) {
    throw new Error("Client not found.");
  }

  const siteAddress =
    String(formData.get("siteAddress") || "").trim() || null;

  const description =
    String(formData.get("description") || "").trim() || null;

  const totalAmount = Number(formData.get("totalAmount"));

  const dateStartedValue = String(formData.get("dateStarted") || "");
  const dateCompletedValue = String(formData.get("dateCompleted") || "");

  await prisma.cctvInstallation.create({
    data: {
      clientId,
      clientName: client.name,
      siteAddress,
      description,
      totalAmount,
      dateStarted: dateStartedValue ? new Date(dateStartedValue) : null,
      completedAt: dateCompletedValue ? new Date(dateCompletedValue) : null,
    },
  });

  revalidatePath("/dashboard/cctv");
}

export async function updateCctvStatus(
  id: string,
  clientId: string,
  status: ServiceStatus,
  totalAmount: number,
  dateStarted: Date | null,
  completedAt: Date | null,
  siteAddress: string,
  description: string
) {
  await requireAdmin();

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true },
  });

  if (!client) {
    throw new Error("Client not found.");
  }

  await prisma.cctvInstallation.update({
    where: { id },
    data: {
      client: {
        connect: {
          id: clientId,
        },
      },
      clientName: client.name,
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
  await requireAdmin();

  await prisma.cctvInstallation.delete({
    where: { id },
  });

  revalidatePath("/dashboard/cctv");
}