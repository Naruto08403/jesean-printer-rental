import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { updatePrinter, addPrinterNote } from "@/actions/printers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export default async function PrinterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const printer = await prisma.printer.findUnique({
    where: { id },
    include: {
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
  });
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
      <h1 className="text-2xl font-bold">
        {[printer.brand, printer.model].filter(Boolean).join(" ") || "Printer"}
      </h1>
      <Badge>{printer.status}</Badge>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Edit</CardTitle>
          <form action={update} className="mt-4 space-y-3">
            <div>
              <Label>Serial</Label>
              <Input name="serialNumber" defaultValue={printer.serialNumber ?? ""} />
            </div>
            <div>
              <Label>Brand</Label>
              <Input name="brand" defaultValue={printer.brand ?? ""} />
            </div>
            <div>
              <Label>Model</Label>
              <Input name="model" defaultValue={printer.model ?? ""} />
            </div>
            <div>
              <Label>Price (PHP)</Label>
              <Input
                name="price"
                type="number"
                step="0.01"
                min="0"
                defaultValue={printer.price ?? ""}
              />
              {printer.price != null && (
                <p className="mt-1 text-xs text-slate-500">
                  Current: {formatCurrency(printer.price)}
                </p>
              )}
            </div>
            <div>
              <Label>Status</Label>
              <Select name="status" defaultValue={printer.status}>
                <option value="AVAILABLE">Available</option>
                <option value="RENTED">Rented</option>
                <option value="IN_REPAIR">In repair</option>
                <option value="RETIRED">Retired</option>
              </Select>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Add audit note</CardTitle>
          <form action={addNote} className="mt-4 flex gap-2">
            <Input name="note" placeholder="Note for audit log..." required className="flex-1" />
            <Button type="submit">Add</Button>
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
                  {r.title}
                </Link>
                <span className="text-slate-500"> · {r.client.name}</span>
              </li>
            ))}
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
