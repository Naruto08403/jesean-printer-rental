import type { AuditAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function logPrinterAudit(
  printerId: string,
  action: AuditAction,
  message: string,
  options?: { metadata?: Record<string, unknown>; userEmail?: string }
) {
  await prisma.printerAuditLog.create({
    data: {
      printerId,
      action,
      message,
      metadata: options?.metadata ? JSON.stringify(options.metadata) : null,
      userEmail: options?.userEmail ?? null,
    },
  });
}
