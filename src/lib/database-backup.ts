import { prisma } from "@/lib/prisma";

export const DATABASE_BACKUP_VERSION = 1;
export const DATABASE_BACKUP_APP = "jesean-rentals";

export type DatabaseBackupPayload = {
  version: number;
  exportedAt: string;
  app: string;
  counts: Record<string, number>;
  data: {
    users: BackupUser[];
    clients: BackupClient[];
    printers: BackupPrinter[];
    rentals: BackupRental[];
    rentalPausePeriods: BackupRentalPausePeriod[];
    rentalAuditLogs: BackupRentalAuditLog[];
    repairs: BackupRepair[];
    sales: BackupSale[];
    cctvInstallations: BackupCctvInstallation[];
    payments: BackupPayment[];
    printerAuditLogs: BackupPrinterAuditLog[];
    repairDiagnosisOptions?: BackupRepairDiagnosisOption[];
  };
};

type BackupUser = {
  id: string;
  email: string | null;
  username: string | null;
  passwordHash: string;
  name: string | null;
  role: string;
  createdAt: string;
  updatedAt: string;
};

type BackupClient = {
  id: string;
  name: string;
  status: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  company: string | null;
  notes: string | null;
  userId: string | null;
  createdAt: string;
  updatedAt: string;
};

type BackupPrinter = {
  id: string;
  serialNumber: string | null;
  brand: string | null;
  model: string | null;
  price: number | null;
  type: string;
  ownerClientId: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type BackupRental = {
  id: string;
  clientId: string;
  printerId: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  ratePerPeriod: number;
  paymentSchedule: string;
  totalContract: number | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type BackupRentalPausePeriod = {
  id: string;
  rentalId: string;
  pausedAt: string;
  resumedAt: string | null;
  createdAt: string;
};

type BackupRentalAuditLog = {
  id: string;
  rentalId: string;
  action: string;
  message: string;
  metadata: string | null;
  userEmail: string | null;
  createdAt: string;
};

type BackupRepair = {
  id: string;
  clientId: string | null;
  customerName: string | null;
  printerId: string | null;
  source: string;
  linkedFromRepairId: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  problem: string;
  diagnosis: string | null;
  status: string;
  totalAmount: number;
  isChargeWaived: boolean;
  receivedAt: string;
  completedAt: string | null;
  title: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

type BackupSale = {
  id: string;
  clientId: string | null;
  status: string;
  items: string;
  totalAmount: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

type BackupCctvInstallation = {
  id: string;
  clientId: string;
  status: string;
  siteAddress: string | null;
  description: string | null;
  totalAmount: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type BackupPayment = {
  id: string;
  amount: number;
  paidAt: string;
  billingYear: number | null;
  billingMonth: number | null;
  batchId: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  rentalId: string | null;
  repairId: string | null;
  saleId: string | null;
  cctvInstallationId: string | null;
  createdAt: string;
};

type BackupPrinterAuditLog = {
  id: string;
  printerId: string;
  action: string;
  message: string;
  metadata: string | null;
  userEmail: string | null;
  createdAt: string;
};

type BackupRepairDiagnosisOption = {
  id: string;
  name: string;
  price: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

function toIso(value: Date | null | undefined): string | null {
  if (value == null) return null;
  return value.toISOString();
}

function parseDate(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d;
}

function parseRequiredDate(value: string): Date {
  const d = parseDate(value);
  if (!d) throw new Error(`Invalid date: ${value}`);
  return d;
}

export async function exportDatabaseBackup(): Promise<DatabaseBackupPayload> {
  const [
    users,
    clients,
    printers,
    rentals,
    rentalPausePeriods,
    rentalAuditLogs,
    repairs,
    sales,
    cctvInstallations,
    payments,
    printerAuditLogs,
    repairDiagnosisOptions,
  ] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.client.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.printer.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.rental.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.rentalPausePeriod.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.rentalAuditLog.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.repair.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.sale.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.cctvInstallation.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.payment.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.printerAuditLog.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.repairDiagnosisOption.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  const data = {
    users: users.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    })),
    clients: clients.map((c) => ({
      ...c,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    printers: printers.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
    rentals: rentals.map((r) => ({
      ...r,
      startDate: r.startDate.toISOString(),
      endDate: toIso(r.endDate),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    rentalPausePeriods: rentalPausePeriods.map((p) => ({
      ...p,
      pausedAt: p.pausedAt.toISOString(),
      resumedAt: toIso(p.resumedAt),
      createdAt: p.createdAt.toISOString(),
    })),
    rentalAuditLogs: rentalAuditLogs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    repairs: repairs.map((r) => ({
      ...r,
      receivedAt: r.receivedAt.toISOString(),
      completedAt: toIso(r.completedAt),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    })),
    sales: sales.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    cctvInstallations: cctvInstallations.map((c) => ({
      ...c,
      completedAt: toIso(c.completedAt),
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
    payments: payments.map((p) => ({
      ...p,
      paidAt: p.paidAt.toISOString(),
      createdAt: p.createdAt.toISOString(),
    })),
    printerAuditLogs: printerAuditLogs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    repairDiagnosisOptions: repairDiagnosisOptions.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    })),
  };

  const counts = Object.fromEntries(
    Object.entries(data).map(([key, rows]) => [key, rows.length])
  );

  return {
    version: DATABASE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: DATABASE_BACKUP_APP,
    counts,
    data,
  };
}

function sortRepairsForImport(repairs: BackupRepair[]): BackupRepair[] {
  const byId = new Map(repairs.map((r) => [r.id, r]));
  const sorted: BackupRepair[] = [];
  const seen = new Set<string>();

  function visit(repair: BackupRepair) {
    if (seen.has(repair.id)) return;
    if (repair.linkedFromRepairId) {
      const parent = byId.get(repair.linkedFromRepairId);
      if (parent) visit(parent);
    }
    seen.add(repair.id);
    sorted.push(repair);
  }

  for (const repair of repairs) visit(repair);
  return sorted;
}

export function validateDatabaseBackup(payload: unknown): DatabaseBackupPayload {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid backup file.");
  }

  const backup = payload as Partial<DatabaseBackupPayload>;

  if (backup.app !== DATABASE_BACKUP_APP) {
    throw new Error("This file is not a Jesean Rentals database backup.");
  }
  if (backup.version !== DATABASE_BACKUP_VERSION) {
    throw new Error(`Unsupported backup version (${String(backup.version)}).`);
  }
  if (!backup.data || typeof backup.data !== "object") {
    throw new Error("Backup file is missing data.");
  }

  const requiredTables = [
    "users",
    "clients",
    "printers",
    "rentals",
    "rentalPausePeriods",
    "rentalAuditLogs",
    "repairs",
    "sales",
    "cctvInstallations",
    "payments",
    "printerAuditLogs",
  ] as const;

  for (const table of requiredTables) {
    const rows = backup.data?.[table];
    if (!Array.isArray(rows)) {
      throw new Error(`Backup file is missing table: ${table}`);
    }
  }

  return backup as DatabaseBackupPayload;
}

export function backupDownloadFilename(exportedAt = new Date()): string {
  const stamp = exportedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return `jesean-rentals-backup-${stamp}.json`;
}

export async function importDatabaseBackup(payload: DatabaseBackupPayload): Promise<{
  counts: Record<string, number>;
}> {
  const backup = validateDatabaseBackup(payload);
  const { data } = backup;
  const sortedRepairs = sortRepairsForImport(data.repairs);

  await prisma.$transaction(
    async (tx) => {
      await tx.payment.deleteMany();
      await tx.printerAuditLog.deleteMany();
      await tx.rentalAuditLog.deleteMany();
      await tx.rentalPausePeriod.deleteMany();
      await tx.rental.deleteMany();
      await tx.repair.deleteMany();
      await tx.repairDiagnosisOption.deleteMany();
      await tx.sale.deleteMany();
      await tx.cctvInstallation.deleteMany();
      await tx.client.deleteMany();
      await tx.printer.deleteMany();
      await tx.user.deleteMany();

      if (data.users.length > 0) {
        await tx.user.createMany({
          data: data.users.map((u) => ({
            ...u,
            role: u.role as never,
            createdAt: parseRequiredDate(u.createdAt),
            updatedAt: parseRequiredDate(u.updatedAt),
          })),
        });
      }

      if (data.clients.length > 0) {
        await tx.client.createMany({
          data: data.clients.map((c) => ({
            ...c,
            status: c.status as never,
            createdAt: parseRequiredDate(c.createdAt),
            updatedAt: parseRequiredDate(c.updatedAt),
          })),
        });
      }

      if (data.printers.length > 0) {
        await tx.printer.createMany({
          data: data.printers.map((p) => ({
            ...p,
            type: (p.type === "WALK_IN" ? "WALK_IN" : "RENTAL") as never,
            status: p.status as never,
            createdAt: parseRequiredDate(p.createdAt),
            updatedAt: parseRequiredDate(p.updatedAt),
          })),
        });
      }

      if (data.rentals.length > 0) {
        await tx.rental.createMany({
          data: data.rentals.map((r) => ({
            ...r,
            status: r.status as never,
            paymentSchedule: r.paymentSchedule as never,
            startDate: parseRequiredDate(r.startDate),
            endDate: parseDate(r.endDate),
            createdAt: parseRequiredDate(r.createdAt),
            updatedAt: parseRequiredDate(r.updatedAt),
          })),
        });
      }

      if (data.rentalPausePeriods.length > 0) {
        await tx.rentalPausePeriod.createMany({
          data: data.rentalPausePeriods.map((p) => ({
            ...p,
            pausedAt: parseRequiredDate(p.pausedAt),
            resumedAt: parseDate(p.resumedAt),
            createdAt: parseRequiredDate(p.createdAt),
          })),
        });
      }

      if (data.rentalAuditLogs.length > 0) {
        await tx.rentalAuditLog.createMany({
          data: data.rentalAuditLogs.map((l) => ({
            ...l,
            action: l.action as never,
            createdAt: parseRequiredDate(l.createdAt),
          })),
        });
      }

      if (sortedRepairs.length > 0) {
        await tx.repair.createMany({
          data: sortedRepairs.map((r) => ({
            ...r,
            source: r.source as never,
            status: r.status as never,
            receivedAt: parseRequiredDate(r.receivedAt),
            completedAt: parseDate(r.completedAt),
            createdAt: parseRequiredDate(r.createdAt),
            updatedAt: parseRequiredDate(r.updatedAt),
          })),
        });
      }

      if (data.sales.length > 0) {
        await tx.sale.createMany({
          data: data.sales.map((s) => ({
            ...s,
            status: s.status as never,
            createdAt: parseRequiredDate(s.createdAt),
            updatedAt: parseRequiredDate(s.updatedAt),
          })),
        });
      }

      if (data.cctvInstallations.length > 0) {
        await tx.cctvInstallation.createMany({
          data: data.cctvInstallations.map((c) => ({
            ...c,
            status: c.status as never,
            completedAt: parseDate(c.completedAt),
            createdAt: parseRequiredDate(c.createdAt),
            updatedAt: parseRequiredDate(c.updatedAt),
          })),
        });
      }

      if (data.payments.length > 0) {
        await tx.payment.createMany({
          data: data.payments.map((p) => ({
            ...p,
            paidAt: parseRequiredDate(p.paidAt),
            createdAt: parseRequiredDate(p.createdAt),
          })),
        });
      }

      if (data.printerAuditLogs.length > 0) {
        await tx.printerAuditLog.createMany({
          data: data.printerAuditLogs.map((l) => ({
            ...l,
            action: l.action as never,
            createdAt: parseRequiredDate(l.createdAt),
          })),
        });
      }

      const diagnosisRows = data.repairDiagnosisOptions ?? [];
      if (diagnosisRows.length > 0) {
        await tx.repairDiagnosisOption.createMany({
          data: diagnosisRows.map((d) => ({
            ...d,
            createdAt: parseRequiredDate(d.createdAt),
            updatedAt: parseRequiredDate(d.updatedAt),
          })),
        });
      }
    },
    { timeout: 120_000 }
  );

  return { counts: backup.counts };
}
