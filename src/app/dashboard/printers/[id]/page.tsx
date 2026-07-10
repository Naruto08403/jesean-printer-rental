import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { updatePrinter, addPrinterNote } from "@/actions/printers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton, FormLoadingOverlay } from "@/components/submit-button";
import { EditPrinterForm } from "@/components/forms/edit-printer-form";
import Link from "next/link";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/utils";
import { formatRepairCustomerLabel, repairDisplayTitle } from "@/lib/repair-device";
import { formatPrinterOwnerLabel, printerTypeLabel } from "@/lib/printer";
import { Badge } from "@/components/ui/badge";

const typeColor: Record<string, "blue" | "amber"> = {
  RENTAL: "blue",
  WALK_IN: "amber",
};

export default async function PrinterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [printer, clients] = await Promise.all([
    prisma.printer.findUnique({
      where: { id },
      include: {
        ownerClient: { select: { name: true } },
        rentals: {
          orderBy: { startDate: "desc" },
          include: { client: true },
        },
        repairs: {
          orderBy: { createdAt: "desc" },
          include: { client: true },
        },
        auditLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      },
    }),
    prisma.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!printer) notFound();

  const update = updatePrinter.bind(null, id);
  const addNote = async (formData: FormData) => {
    "use server";
    await addPrinterNote(id, String(formData.get("note") ?? ""));
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/printers" className="text-sm text-brand-600 hover:underline">
        ← Printers
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">
          {[printer.brand, printer.model].filter(Boolean).join(" ") || "Printer"}
        </h1>
        <Badge color={typeColor[printer.type]}>{printerTypeLabel(printer.type)}</Badge>
        <Badge>{printer.status}</Badge>
      </div>
      <p className="text-sm text-slate-600">
        Owner: <strong>{formatPrinterOwnerLabel(printer)}</strong>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Edit</CardTitle>
          <EditPrinterForm printer={printer} clients={clients} action={update} />
        </Card>

        <Card>
          <CardTitle>Add audit note</CardTitle>
          <form action={addNote} className="mt-4 flex gap-2">
            <Input name="note" placeholder="Note for audit log..." required className="flex-1" />
            <SubmitButton loadingText="Adding…">Add</SubmitButton>
            <FormLoadingOverlay message="Adding note…" />
          </form>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Rental history</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {printer.rentals.map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/rentals/${r.id}`} className="font-medium text-brand-600">
                  {r.client.name}
                </Link>
                <span className="text-slate-500"> · {r.status}</span>
              </li>
            ))}
            {printer.rentals.length === 0 && (
              <li className="text-slate-500">No rentals yet</li>
            )}
          </ul>
        </Card>
        <Card>
          <CardTitle>Repair history</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {printer.repairs.map((r) => (
              <li key={r.id}>
                <Link href={`/dashboard/repairs/${r.id}`} className="font-medium text-brand-600">
                  {repairDisplayTitle(r)}
                </Link>
                <span className="text-slate-500">
                  {" "}
                  · {formatRepairCustomerLabel(r)} · {formatDate(r.receivedAt)}
                </span>
              </li>
            ))}
            {printer.repairs.length === 0 && (
              <li className="text-slate-500">No repairs yet</li>
            )}
          </ul>
        </Card>
      </div>

      <Card>
        <CardTitle>Audit log</CardTitle>
        <ul className="mt-4 max-h-96 space-y-3 overflow-y-auto text-sm">
          {printer.auditLogs.map((log) => (
            <li key={log.id} className="border-l-2 border-brand-200 pl-3">
              <p className="font-medium">{log.message}</p>
              <p className="text-xs text-slate-500">
                {log.action} · {formatDateTime(log.createdAt)}
                {log.userEmail && ` · ${log.userEmail}`}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
