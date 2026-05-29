"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import bcrypt from "bcryptjs";
import Papa from "papaparse";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

export async function createClient(formData: FormData) {
  await requireAdmin();
  const parsed = clientSchema.parse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    company: formData.get("company") || undefined,
    notes: formData.get("notes") || undefined,
  });

  await prisma.client.create({
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone || null,
      address: parsed.address || null,
      company: parsed.company || null,
      notes: parsed.notes || null,
    },
  });
  revalidatePath("/dashboard/clients");
}

export async function updateClient(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = clientSchema.parse({
    name: formData.get("name"),
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    address: formData.get("address") || undefined,
    company: formData.get("company") || undefined,
    notes: formData.get("notes") || undefined,
  });

  await prisma.client.update({
    where: { id },
    data: {
      name: parsed.name,
      email: parsed.email || null,
      phone: parsed.phone || null,
      address: parsed.address || null,
      company: parsed.company || null,
      notes: parsed.notes || null,
    },
  });
  revalidatePath("/dashboard/clients");
  revalidatePath(`/dashboard/clients/${id}`);
}

export async function importClientsFromCsv(csvText: string) {
  await requireAdmin();
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message ?? "Invalid CSV");
  }

  let created = 0;
  for (const row of parsed.data) {
    const name =
      row.name?.trim() ||
      row.client_name?.trim() ||
      row.full_name?.trim();
    if (!name) continue;

    await prisma.client.create({
      data: {
        name,
        email: row.email?.trim() || null,
        phone: row.phone?.trim() || row.mobile?.trim() || null,
        address: row.address?.trim() || null,
        company: row.company?.trim() || null,
        notes: row.notes?.trim() || null,
      },
    });
    created++;
  }

  revalidatePath("/dashboard/clients");
  return { created };
}

const usernameSchema = z
  .string()
  .min(3, "Username must be at least 3 characters")
  .max(32)
  .regex(/^[a-zA-Z0-9._-]+$/, "Letters, numbers, dots, dashes, underscores only");

export async function createClientPortalLogin(
  clientId: string,
  formData: FormData
) {
  await requireAdmin();
  const username = usernameSchema.parse(
    String(formData.get("username") ?? "").toLowerCase().trim()
  );
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new Error("Client not found");
  if (client.userId) throw new Error("Client already has portal access");

  const existing = await prisma.user.findFirst({ where: { username } });
  if (existing) throw new Error("Username already in use");

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      name: client.name,
      role: "CLIENT",
    },
  });

  await prisma.client.update({
    where: { id: clientId },
    data: { userId: user.id },
  });

  revalidatePath(`/dashboard/clients/${clientId}`);
}
