"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileSpreadsheet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { LoadingOverlay } from "@/components/loading-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RepairBillingPriceEditor } from "@/components/forms/repair-billing-price-editor";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { RepairPaymentOption } from "@/actions/payments";
import type { RepairBillingPreviewItem } from "@/lib/repair-billing-lines";

function todayDateInput() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type Step = "select" | "preview";

export function GenerateRepairBillingModal({
  repairs,
}: {
  repairs: RepairPaymentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("select");
  const [clientKey, setClientKey] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [issueDate, setIssueDate] = useState(todayDateInput());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [previewClientName, setPreviewClientName] = useState("");
  const [billingItems, setBillingItems] = useState<RepairBillingPreviewItem[]>([]);
  const [jobOrderItems, setJobOrderItems] = useState<RepairBillingPreviewItem[]>([]);
  const [activeTab, setActiveTab] = useState<"billing" | "jobOrder">("jobOrder");

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
    setStep("select");
    setIssueDate(todayDateInput());
    setError(null);
    setPreviewClientName("");
    setBillingItems([]);
    setJobOrderItems([]);
    setActiveTab("jobOrder");
  }

  function toggleRepair(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function loadPreview() {
    setError(null);
    if (selectedIds.length === 0) {
      setError("Select at least one repair job.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/repairs/billing/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedGroup?.clientId ?? null,
            repairIds: selectedIds,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to load preview");
        }

        const data = await res.json();
        setPreviewClientName(data.clientName);
        setBillingItems(data.billingStatementItems);
        setJobOrderItems(data.jobOrderItems);
        setStep("preview");
        setActiveTab("jobOrder");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      }
    });
  }

  function handleDownload(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch("/api/repairs/billing/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId: selectedGroup?.clientId ?? null,
            repairIds: selectedIds,
            issueDate,
            billingStatementItems: billingItems,
            jobOrderItems: jobOrderItems,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to generate billing");
        }

        const blob = await res.blob();
        const disposition = res.headers.get("Content-Disposition");
        const match = disposition?.match(/filename="([^"]+)"/);
        const filename = match?.[1] ?? "repair-billing.pdf";
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
          message={step === "select" ? "Loading preview…" : "Generating repair billing…"}
          submessage={step === "select" ? "Preparing editable prices." : "Preparing your PDF file."}
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
        title={step === "select" ? "Download repair billing" : "Review & edit prices"}
        className="max-w-3xl"
      >
        {repairs.length === 0 ? (
          <p className="text-sm text-slate-500">No billable repair jobs yet.</p>
        ) : step === "select" ? (
          <div className="space-y-4 text-slate-900">
            <p className="text-sm text-slate-600">
              Select jobs, then review and adjust prices in the browser before downloading the PDF.
            </p>

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
              <Button
                type="button"
                loading={pending}
                disabled={selectedIds.length === 0}
                onClick={loadPreview}
              >
                {pending ? "Loading…" : "Next: Review prices"}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleDownload} className="space-y-4 text-slate-900">
            <p className="text-sm text-slate-600">
              Customer: <strong>{previewClientName}</strong> · issued{" "}
              <strong>{issueDate}</strong>
            </p>

            <RepairBillingPriceEditor
              billingItems={billingItems}
              jobOrderItems={jobOrderItems}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              onBillingChange={setBillingItems}
              onJobOrderChange={setJobOrderItems}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-between gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="secondary" onClick={() => setStep("select")}>
                Back
              </Button>
              <div className="flex gap-2">
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
                <Button type="submit" loading={pending}>
                  {pending ? "Generating…" : "Download PDF"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
