import { PageHeader } from "@/components/page-header";
import { DatabaseBackupPanel } from "@/components/database-backup-panel";
import { prisma } from "@/lib/prisma";

export default async function DatabaseBackupPage() {
  const [clients, printers, rentals, repairs, payments] = await Promise.all([
    prisma.client.count(),
    prisma.printer.count(),
    prisma.rental.count(),
    prisma.repair.count(),
    prisma.payment.count(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Database backup"
        subtitle="Export a local JSON backup or restore from a previous export"
      />

      <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
        Current database: {clients} clients · {printers} printers · {rentals} rentals ·{" "}
        {repairs} repairs · {payments} payments
      </div>

      <DatabaseBackupPanel />
    </div>
  );
}
