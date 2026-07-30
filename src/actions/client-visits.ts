"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireVisitStaffOrAdmin } from "@/lib/auth";
import { daysSinceVisit, VISIT_REASONS } from "@/lib/client-visits";

const REVALIDATE_PATHS = ["/dashboard/visits", "/visits"];

function revalidateVisitPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export type VisitHistoryItem = {
  id: string;
  visitedAt: string;
  reason: string;
  notes: string | null;
};

export type VisitClientRow = {
  clientId: string;
  clientName: string;
  lastVisitAt: string | null;
  lastReason: string | null;
  daysAfter: number | null;
  visits: VisitHistoryItem[];
};

function parseVisitReason(formData: FormData) {
  const reasonRaw = String(formData.get("reason") || "").trim();
  const customReason = String(formData.get("customReason") || "").trim();
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!reasonRaw) throw new Error("Reason is required");
  if (!VISIT_REASONS.includes(reasonRaw as (typeof VISIT_REASONS)[number])) {
    throw new Error("Invalid visit reason");
  }

  const reason =
    reasonRaw === "Other" ? customReason || notes || "Other" : reasonRaw;

  return { reason, notes, reasonRaw };
}

function parseVisitedAt(formData: FormData) {
  const visitedAtRaw = String(formData.get("visitedAt") || "").trim();
  if (!visitedAtRaw) return new Date();

  const parsed = new Date(visitedAtRaw);
  if (Number.isNaN(parsed.getTime())) throw new Error("Invalid visit date");
  return parsed;
}

async function assertActiveRentalClient(clientId: string) {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      status: "ACTIVE",
      rentals: { some: { status: { in: ["ACTIVE", "PAUSED"] } } },
    },
    select: { id: true },
  });
  if (!client) throw new Error("Client is not an active rental client");
}

export async function listActiveRentalVisitClients(): Promise<VisitClientRow[]> {
  await requireVisitStaffOrAdmin();

  const clients = await prisma.client.findMany({
    where: {
      status: "ACTIVE",
      rentals: {
        some: {
          status: { in: ["ACTIVE", "PAUSED"] },
        },
      },
    },
    orderBy: { name: "asc" },
    include: {
      visits: {
        orderBy: { visitedAt: "desc" },
      },
    },
  });

  return clients.map((client) => {
    const last = client.visits[0] ?? null;
    return {
      clientId: client.id,
      clientName: client.name,
      lastVisitAt: last?.visitedAt.toISOString() ?? null,
      lastReason: last?.reason ?? null,
      daysAfter: daysSinceVisit(last?.visitedAt ?? null),
      visits: client.visits.map((visit) => ({
        id: visit.id,
        visitedAt: visit.visitedAt.toISOString(),
        reason: visit.reason,
        notes: visit.notes,
      })),
    };
  });
}

export async function createClientVisit(formData: FormData) {
  await requireVisitStaffOrAdmin();

  const clientId = String(formData.get("clientId") || "").trim();
  if (!clientId) throw new Error("Client is required");

  const { reason, notes } = parseVisitReason(formData);
  const visitedAt = parseVisitedAt(formData);

  await assertActiveRentalClient(clientId);

  await prisma.clientVisit.create({
    data: {
      clientId,
      reason,
      notes,
      visitedAt,
    },
  });

  revalidateVisitPaths();
}

export async function updateClientVisit(visitId: string, formData: FormData) {
  await requireVisitStaffOrAdmin();

  const { reason, notes } = parseVisitReason(formData);
  const visitedAt = parseVisitedAt(formData);

  const existing = await prisma.clientVisit.findUnique({
    where: { id: visitId },
    select: { id: true },
  });
  if (!existing) throw new Error("Visit not found");

  await prisma.clientVisit.update({
    where: { id: visitId },
    data: { reason, notes, visitedAt },
  });

  revalidateVisitPaths();
}

export async function deleteClientVisit(visitId: string) {
  await requireVisitStaffOrAdmin();

  const existing = await prisma.clientVisit.findUnique({
    where: { id: visitId },
    select: { id: true },
  });
  if (!existing) throw new Error("Visit not found");

  await prisma.clientVisit.delete({ where: { id: visitId } });
  revalidateVisitPaths();
}
