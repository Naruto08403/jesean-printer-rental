"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const REVALIDATE_PATHS = ["/dashboard/visits"];

function revalidateVisitStaffPaths() {
  for (const path of REVALIDATE_PATHS) {
    revalidatePath(path);
  }
}

export async function listVisitStaffUsers() {
  await requireAdmin();
  return prisma.user.findMany({
    where: { role: "VISIT_STAFF" },
    orderBy: { username: "asc" },
    select: {
      id: true,
      username: true,
      name: true,
      createdAt: true,
    },
  });
}

export async function createVisitStaffUser(formData: FormData) {
  await requireAdmin();

  const username = String(formData.get("username") || "").trim().toLowerCase();
  const name = String(formData.get("name") || "").trim() || null;
  const password = String(formData.get("password") || "");

  if (!username) throw new Error("Username is required");
  if (password.length < 6) throw new Error("Password must be at least 6 characters");

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username }, { email: username }] },
    select: { id: true },
  });
  if (existing) throw new Error("Username is already taken");

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      username,
      name,
      passwordHash,
      role: "VISIT_STAFF",
    },
  });

  revalidateVisitStaffPaths();
}

export async function deleteVisitStaffUser(id: string) {
  await requireAdmin();
  const user = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!user || user.role !== "VISIT_STAFF") {
    throw new Error("Visit staff account not found");
  }
  await prisma.user.delete({ where: { id } });
  revalidateVisitStaffPaths();
}
