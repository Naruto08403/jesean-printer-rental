"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import {
  addBulkRepairPayments,
  type RepairPaymentOption,
} from "@/actions/payments";
import { repairClientKey } from "@/lib/repair-client-key";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";

function todayDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatAmount(value: number) {
  if (!value) return "";
  return String(Math.round(value * 100) / 100);
}

export type RepairPaymentPreset = {
  clientKey: string;
  /** If set, ensure these jobs are selected (typically all unpaid for client). */
  repairIds?: string[];
};

export function AddRepairPaymentModal({
  repairs,
  showTrigger = true,
  open: controlledOpen,
  onOpenChange,
  preset,
}: {
  repairs: RepairPaymentOption[];
  showTrigger?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  preset?: RepairPaymentPreset | null;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [clientKey, setClientKey] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const clientGroups = useMemo(() => {
    const map = new Map<
      string,
      { label: string; clientId: string | null; repairs: RepairPaymentOption[] }
    >();
    for (const r of repairs) {
      const key = repairClientKey(r.clientId, r.clientLabel);
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
  const withBalance = (selectedGroup?.repairs ?? []).filter((r) => r.balance > 0.001);
  const selectedRepairs = withBalance.filter((r) => selectedIds.includes(r.id));
  const totalBalance = selectedRepairs.reduce((s, r) => s + r.balance, 0);

  function applyPreset(p: RepairPaymentPreset | null | undefined) {
    if (!p) return;
    setClientKey(p.clientKey);
    const group = clientGroups.find(([key]) => key === p.clientKey)?.[1];
    const unpaidIds = (group?.repairs ?? [])
      .filter((r) => r.balance > 0.001)
      .map((r) => r.id);
    if (p.repairIds?.length) {
      const valid = p.repairIds.filter((id) => unpaidIds.includes(id));
      setSelectedIds(valid.length > 0 ? valid : unpaidIds);
    } else {
      setSelectedIds(unpaidIds);
    }
    const sel = (p.repairIds?.length ? p.repairIds : unpaidIds)
      .map((id) => group?.repairs.find((r) => r.id === id))
      .filter(Boolean) as RepairPaymentOption[];
    const balance = sel.reduce((s, r) => s + r.balance, 0);
    if (balance > 0) setAmount(formatAmount(balance));
  }

  useEffect(() => {
    if (!open) return;
    if (preset && clientGroups.length > 0) {
      applyPreset(preset);
    } else if (!preset && !clientKey && clientGroups.length > 0) {
      setClientKey(clientGroups[0]![0]);
    }
  }, [open, preset, clientGroups]);

  useEffect(() => {
    if (!open || preset) return;
    const group = clientGroups.find(([key]) => key === clientKey)?.[1];
    const ids = (group?.repairs ?? [])
      .filter((r) => r.balance > 0.001)
      .map((r) => r.id);
    setSelectedIds(ids);
  }, [clientKey, clientGroups, open, preset]);

  function resetForm() {
    setClientKey(clientGroups[0]?.[0] ?? "");
    setSelectedIds([]);
    setAmount("");
    setError(null);
  }

  function toggleRepair(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function handleClose() {
    setOpen(false);
    resetForm();
  }

  return (
    <>
      {pending && <LoadingOverlay message="Saving payments…" />}
      {showTrigger && (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
          <Banknote className="h-4 w-4" />
          Add payment
        </Button>
      )}
      <Modal open={open} onClose={handleClose} title="Record repair payments" className="max-w-2xl">
        <p className="mb-4 text-sm text-slate-600">
          Select a client and one or more open repair jobs. One payment is split across jobs by
          balance due (partial payments allowed per job).
        </p>
        {repairs.length === 0 ? (
          <p className="text-sm text-slate-500">No billable repair jobs yet.</p>
        ) : (
          <form
            className="space-y-4"
            action={(fd) =>
              startTransition(async () => {
                setError(null);
                try {
                  for (const id of selectedIds) fd.append("repairId", id);
                  if (selectedGroup?.clientId) {
                    fd.set("clientId", selectedGroup.clientId);
                  }
                  await addBulkRepairPayments(fd);
                  handleClose();
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Failed to save payments");
                }
              })
            }
          >
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
                    {group.label} ({group.repairs.filter((r) => r.balance > 0.001).length} with
                    balance)
                  </option>
                ))}
              </Select>
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
              {withBalance.length === 0 && (
                <p className="text-sm text-slate-500">All jobs for this client are fully paid.</p>
              )}
              {withBalance.map((r) => (
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
                      {r.printerLabel} · {formatDate(r.receivedAt)} · {r.status.replace("_", " ")}
                    </p>
                    <p className="mt-1 text-xs">
                      Due {formatCurrency(r.balance)} of {formatCurrency(r.totalAmount)}
                      {r.paid > 0 && (
                        <span className="text-emerald-700"> · paid {formatCurrency(r.paid)}</span>
                      )}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            {selectedRepairs.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <p>
                  {selectedRepairs.length} job{selectedRepairs.length === 1 ? "" : "s"} selected ·
                  total balance <strong>{formatCurrency(totalBalance)}</strong>
                </p>
                <Button
                  type="button"
                  variant="ghost"
                  className="mt-1 h-auto px-0 py-0 text-brand-600"
                  onClick={() => setAmount(formatAmount(totalBalance))}
                >
                  Use full balance
                </Button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Total payment (PHP) *</Label>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label>Payment date *</Label>
                <Input name="paidAt" type="date" required defaultValue={todayDateInput()} />
              </div>
              <div>
                <Label>Method</Label>
                <Input name="method" placeholder="Cash, GCash, Bank..." />
              </div>
              <div>
                <Label>Reference</Label>
                <Input name="reference" placeholder="OR / receipt #" />
              </div>
              <div className="sm:col-span-2">
                <Label>Notes</Label>
                <Input name="notes" placeholder="Optional note for all payments" />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                loading={pending}
                disabled={selectedIds.length === 0 || !amount}
              >
                {pending ? "Saving..." : "Save payments"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}

export function openRepairPaymentForClient(
  clientId: string | null,
  clientLabel: string
): RepairPaymentPreset {
  return { clientKey: repairClientKey(clientId, clientLabel) };
}
