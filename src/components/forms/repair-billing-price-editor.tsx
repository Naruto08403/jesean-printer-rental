"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  repairBillingLineTotal,
  syncBillingTotalsFromJobOrder,
  type RepairBillingPreviewItem,
} from "@/lib/repair-billing-lines";
import { formatCurrency } from "@/lib/utils";

type Tab = "billing" | "jobOrder";

export function RepairBillingPriceEditor({
  billingItems,
  jobOrderItems,
  activeTab,
  onTabChange,
  onBillingChange,
  onJobOrderChange,
}: {
  billingItems: RepairBillingPreviewItem[];
  jobOrderItems: RepairBillingPreviewItem[];
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  onBillingChange: (items: RepairBillingPreviewItem[]) => void;
  onJobOrderChange: (items: RepairBillingPreviewItem[]) => void;
}) {
  const billingTotal = useMemo(() => repairBillingLineTotal(billingItems), [billingItems]);
  const jobOrderTotal = useMemo(() => repairBillingLineTotal(jobOrderItems), [jobOrderItems]);

  function updateBillingAmount(key: string, value: string) {
    const amount = value === "" ? null : Number(value);
    onBillingChange(
      billingItems.map((item) =>
        item.key === key
          ? { ...item, amount: amount != null && Number.isFinite(amount) ? amount : null }
          : item
      )
    );
  }

  function updateJobOrderAmount(key: string, value: string) {
    const amount = value === "" ? null : Number(value);
    onJobOrderChange(
      jobOrderItems.map((item) =>
        item.key === key
          ? { ...item, amount: amount != null && Number.isFinite(amount) ? amount : null }
          : item
      )
    );
  }

  function syncBillingFromJobOrder() {
    onBillingChange(syncBillingTotalsFromJobOrder(billingItems, jobOrderItems));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onTabChange("billing")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            activeTab === "billing"
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Billing statement
        </button>
        <button
          type="button"
          onClick={() => onTabChange("jobOrder")}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            activeTab === "jobOrder"
              ? "bg-brand-600 text-white"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          Job order
        </button>
        {activeTab === "billing" && (
          <Button type="button" variant="secondary" onClick={syncBillingFromJobOrder}>
            Sync totals from job order
          </Button>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Adjust prices before downloading. Changes apply only to this PDF — repair records in the
        system are not updated.
      </p>

      {activeTab === "billing" ? (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium">Price (PHP)</th>
              </tr>
            </thead>
            <tbody>
              {billingItems.map((item) => (
                <tr key={item.key} className="border-b border-slate-50">
                  <td className="px-3 py-2 align-top text-slate-700">{item.unitLabel}</td>
                  <td className="px-3 py-2 align-top whitespace-pre-wrap text-slate-700">
                    {item.description}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amount ?? ""}
                      onChange={(e) => updateBillingAmount(item.key, e.target.value)}
                      className="w-28"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/80">
                <td colSpan={2} className="px-3 py-2 text-right font-medium text-slate-700">
                  Total
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {formatCurrency(billingTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50/95">
              <tr className="border-b border-slate-100 text-left text-slate-500">
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 font-medium">Diagnosis</th>
                <th className="px-3 py-2 font-medium">Price (PHP)</th>
              </tr>
            </thead>
            <tbody>
              {jobOrderItems.map((item) => (
                <tr key={item.key} className="border-b border-slate-50">
                  <td className="px-3 py-2 align-top text-slate-700">{item.unitLabel}</td>
                  <td className="px-3 py-2 align-top text-slate-700">{item.description}</td>
                  <td className="px-3 py-2 align-top">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amount ?? ""}
                      onChange={(e) => updateJobOrderAmount(item.key, e.target.value)}
                      className="w-28"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 bg-slate-50/95">
              <tr>
                <td colSpan={2} className="px-3 py-2 text-right font-medium text-slate-700">
                  Total
                </td>
                <td className="px-3 py-2 font-semibold text-slate-900">
                  {formatCurrency(jobOrderTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
