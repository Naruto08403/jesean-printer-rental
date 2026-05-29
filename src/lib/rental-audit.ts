import type { RentalAuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logRentalAudit(
  rentalId: string,
  action: RentalAuditAction,
  message: string,
  options?: { metadata?: Record<string, unknown>; userEmail?: string | null }
) {
  await prisma.rentalAuditLog.create({
    data: {
      rentalId,
      action,
      message,
      metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
      userEmail: options?.userEmail ?? null,
    },
  });
}

export function rentalStatusAuditMessage(
  from: string,
  to: string
): { action: RentalAuditAction; message: string } {
  if (to === "PAUSED") {
    return {
      action: "PAUSED",
      message: "Rental paused — billing stopped (e.g. vacation break)",
    };
  }
  if (from === "PAUSED" && to === "ACTIVE") {
    return {
      action: "RESUMED",
      message: "Rental resumed — billing active again",
    };
  }
  if (to === "COMPLETED") {
    return {
      action: "RETURNED",
      message: "Rental completed — printer returned",
    };
  }
  return {
    action: "STATUS_CHANGED",
    message: `Status changed from ${from.replace("_", " ")} to ${to.replace("_", " ")}`,
  };
}
