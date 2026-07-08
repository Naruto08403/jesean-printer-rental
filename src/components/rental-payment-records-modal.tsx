"use client";

import { Fragment, useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, Pencil, Trash2 } from "lucide-react";
import {
  deleteRentalPaymentGroup,
  getRentalPaymentRecords,
  updateRentalPaymentGroup,
} from "@/actions/payments";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  defaultRentalAnnualYear,
  rentalAnnualYearOptions,
} from "@/lib/rental-annual";
import type { RentalPaymentRecordGroup } from "@/lib/rental-payment-records";

type ClientOption = { id: string; label: string };

function toDateInputValue(iso: string) {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function EditPaymentGroupForm({
  record,
  onCancel,
  onSaved,
}: {
  record: RentalPaymentRecordGroup;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {pending && <LoadingOverlay message="Updating payment record…" />}
      <form
      className="grid gap-3 border-t border-slate-100 bg-slate-50/80 p-4 sm:grid-cols-2"
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          try {
            fd.set("paymentIds", record.paymentIds.join(","));
            await updateRentalPaymentGroup(fd);
            onSaved();
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to update");
          }
        })
      }
    >
      <div>
        <Label>Payment date</Label>
        <Input name="paidAt" type="date" defaultValue={toDateInputValue(record.date)} />
      </div>
      <div>
        <Label>OR #</Label>
        <Input name="reference" defaultValue={record.reference ?? ""} placeholder="Receipt no." />
      </div>
      <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="text-xs font-medium text-slate-600">Amount (auto)</p>
        <p className="text-sm text-slate-700">
          Uses current printer prices for each unit in this record.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Current total: {formatCurrency(record.amount)} · {record.entryCount} entries
        </p>
      </div>
      <div>
        <Label>Method</Label>
        <Input name="method" defaultValue={record.method ?? ""} placeholder="Cash, GCash..." />
      </div>
      <div className="sm:col-span-2">
        <Label>Notes</Label>
        <Input name="notes" defaultValue={record.notes ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <p className="text-xs text-slate-500">Months covered: {record.monthRange}</p>
        <p className="text-xs text-amber-700">
          Delete removes the entire saved batch (all printer units and months entered together).
        </p>
      </div>
      {error && (
        <p className="text-sm text-red-600 sm:col-span-2" role="alert">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2 sm:col-span-2">
        <Button
          type="button"
          variant="danger"
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              try {
                const fd = new FormData();
                fd.set("paymentIds", record.paymentIds.join(","));
                await deleteRentalPaymentGroup(fd);
                onSaved();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Failed to delete");
              }
            })
          }
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
    </>
  );
}

export function RentalPaymentRecordsModal({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [year, setYear] = useState(defaultRentalAnnualYear());
  const [records, setRecords] = useState<RentalPaymentRecordGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const router = useRouter();
  const years = rentalAnnualYearOptions();

  const loadRecords = useCallback(async (selectedClientId: string, selectedYear: number) => {
    if (!selectedClientId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    try {
      const data = await getRentalPaymentRecords(selectedClientId, selectedYear);
      setRecords(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (!clientId && clients[0]) {
      setClientId(clients[0].id);
      return;
    }
    if (clientId) {
      void loadRecords(clientId, year);
    }
  }, [open, clientId, year, clients, loadRecords]);

  function handleClose() {
    setOpen(false);
    setEditingId(null);
    setRecords([]);
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <FileText className="h-4 w-4" />
        Payment records
      </Button>
      <Modal
        open={open}
        onClose={handleClose}
        title="Rental payment records"
        className="max-w-4xl"
      >
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="min-w-[200px] flex-1">
            <Label>Client</Label>
            <Select
              value={clientId}
              onChange={(e) => {
                setEditingId(null);
                setClientId(e.target.value);
              }}
            >
              <option value="">Select client</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-28">
            <Label>Year</Label>
            <Select
              value={String(year)}
              onChange={(e) => {
                setEditingId(null);
                setYear(Number(e.target.value));
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-500">
                <th className="px-3 py-2.5 font-medium">Date</th>
                <th className="px-3 py-2.5 font-medium">OR #</th>
                <th className="px-3 py-2.5 font-medium text-right">Amount</th>
                <th className="px-3 py-2.5 font-medium">Months</th>
                <th className="px-3 py-2.5 font-medium">Notes</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Loading...
                  </td>
                </tr>
              )}
              {!loading && !clientId && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Select a client to view payment history.
                  </td>
                </tr>
              )}
              {!loading && clientId && records.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    No payment records for {year}.
                  </td>
                </tr>
              )}
              {!loading &&
                records.map((record) => (
                  <Fragment key={record.id}>
                    <tr className="border-b border-slate-50">
                      <td className="px-3 py-2.5">{formatDate(record.date)}</td>
                      <td className="px-3 py-2.5 text-slate-600">{record.reference || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        {formatCurrency(record.amount)}
                      </td>
                      <td className="px-3 py-2.5">{record.monthRange}</td>
                      <td className="max-w-[180px] truncate px-3 py-2.5 text-slate-600">
                        {record.notes || "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-8 px-2"
                          onClick={() =>
                            setEditingId((current) =>
                              current === record.id ? null : record.id
                            )
                          }
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                      </td>
                    </tr>
                    {editingId === record.id && (
                      <tr>
                        <td colSpan={6} className="p-0">
                          <EditPaymentGroupForm
                            record={record}
                            onCancel={() => setEditingId(null)}
                            onSaved={() => {
                              setEditingId(null);
                              void loadRecords(clientId, year);
                              router.refresh();
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </>
  );
}
