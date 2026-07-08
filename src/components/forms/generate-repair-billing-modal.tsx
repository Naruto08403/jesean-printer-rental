"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { RepairPaymentOption } from "@/actions/payments";

function todayDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function GenerateRepairBillingModal({
  repairs,
}: {
  repairs: RepairPaymentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [clientKey, setClientKey] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [issueDate, setIssueDate] = useState(todayDateInput());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const clientGroups = useMemo(() => {
    const map = new Map<string, { label: string; clientId: string | null; repairs: RepairPaymentOption[] }>();
    for (const r of repairs) {
      const key = r.clientId ?? `walkin:${r.clientLabel}`;
      const group = map.get(key) ?? {
        label: r.clientLabel,
        clientId: r.clientId,
        repairs: [],
      };
      group.repairs.push(r);
      map.set(key, group);
    }
    return [...map.entries()].sort((a, b) => a[1].label.localeCompare(b[1].label));
  }, [repairs]);

  const selectedGroup = clientGroups.find(([key]) => key === clientKey)?.[1];
  const groupRepairs = selectedGroup?.repairs ?? [];
  const selectedRepairs = groupRepairs.filter((r) => selectedIds.includes(r.id));
  const statementTotal = selectedRepairs.reduce((s, r) => s + r.totalAmount, 0);
  const statementBalance = selectedRepairs.reduce((s, r) => s + r.balance, 0);

  useEffect(() => {
    if (!clientKey && clientGroups.length > 0) {
      setClientKey(clientGroups[0]![0]);
    }
  }, [clientKey, clientGroups]);

  useEffect(() => {
    const group = clientGroups.find(([key]) => key === clientKey)?.[1];
    setSelectedIds((group?.repairs ?? []).map((r) => r.id));
  }, [clientKey, clientGroups]);

  function resetForm() {
    setIssueDate(todayDateInput());
    setError(null);
  }

  function toggleRepair(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (selectedIds.length === 0) {
      setError("Select at least one repair job.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/repairs/billing/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedGroup?.clientId ?? null,
            repairIds: selectedIds,
            issueDate,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to generate billing");
        }

        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        const match = disposition?.match(/filename="([^"]+)"/);
        const filename = match?.[1] ?? "repair-billing.xlsx";
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setOpen(false);
        resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate billing");
      }
    });
  }

  return (
    <>
      {pending && (
        <LoadingOverlay
          message="Generating repair billing…"
          submessage="Preparing your Excel file."
        />
      )}
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        <FileSpreadsheet className="h-4 w-4" />
        Repair billing
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          resetForm();
        }}
        title="Download repair billing"
        className="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4 text-slate-900">
          <p className="text-sm text-slate-600">
            Excel statement with line items per repair job — device, problem, amount, paid, and
            balance.
          </p>

          {repairs.length === 0 ? (
            <p className="text-sm text-slate-500">No billable repair jobs yet.</p>
          ) : (
            <>
              <div>
                <Label>Client / customer</Label>
                <Select
                  value={clientKey}
                  onChange={(e) => setClientKey(e.target.value)}
                  className="mt-1"
                  required
                >
                  {clientGroups.map(([key, group]) => (
                    <option key={key} value={key}>
                      {group.label} ({group.repairs.length} job
                      {group.repairs.length === 1 ? "" : "s"})
                    </option>
                  ))}
                </Select>
              </div>

              <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                {groupRepairs.map((r) => (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(r.id)}
                      onChange={() => toggleRepair(r.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-medium text-slate-900">{r.problem}</p>
                      <p className="text-xs text-slate-500">
                        {r.printerLabel} · {formatDate(r.receivedAt)}
                      </p>
                      <p className="mt-1 text-xs text-slate-600">
                        {formatCurrency(r.totalAmount)}
                        {r.balance > 0 ? (
                          <span className="text-red-600"> · due {formatCurrency(r.balance)}</span>
                        ) : (
                          <span className="text-emerald-700"> · paid</span>
                        )}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {selectedRepairs.length > 0 && (
                <p className="text-sm text-slate-600">
                  {selectedRepairs.length} line{selectedRepairs.length === 1 ? "" : "s"} · total{" "}
                  <strong>{formatCurrency(statementTotal)}</strong>
                  {statementBalance > 0 && (
                    <>
                      {" "}
                      · balance due <strong>{formatCurrency(statementBalance)}</strong>
                    </>
                  )}
                </p>
              )}

              <div>
                <Label htmlFor="repair-billing-date">Date issued</Label>
                <Input
                  id="repair-billing-date"
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    resetForm();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={pending} disabled={selectedIds.length === 0}>
                  {pending ? "Generating…" : "Download Excel"}
                </Button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </>
  );
}
