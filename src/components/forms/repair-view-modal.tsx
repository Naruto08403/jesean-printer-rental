"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RepairPrinterSource, ServiceStatus } from "@prisma/client";
import { getRepairDeviceTimeline, type getRepairFormOptions } from "@/actions/repairs";
import { EditRepairJobForm, type RepairEdit } from "@/components/forms/edit-repair-job-form";
import { PaymentForm } from "@/components/payment-form";
import { PaymentStatus } from "@/components/payment-status";
import { RepairDeviceHistory } from "@/components/repair-device-history";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { sourceLabel } from "@/lib/repair-device";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PaymentSummary } from "@/lib/payments";

type FormOptions = Awaited<ReturnType<typeof getRepairFormOptions>>;

export type RepairDetailPayload = {
  id: string;
  title: string;
  subtitle: string;
  source: RepairPrinterSource;
  status: ServiceStatus;
  isChargeWaived: boolean;
  paymentSummary: PaymentSummary;
  payments: {
    id: string;
    amount: number;
    paidAt: string;
    method: string | null;
    reference: string | null;
  }[];
  edit: RepairEdit;
};

export function RepairViewModal({
  repair,
  options,
  open,
  onClose,
}: {
  repair: RepairDetailPayload | null;
  options: FormOptions;
  open: boolean;
  onClose: () => void;
}) {
  const [timeline, setTimeline] = useState<
    Awaited<ReturnType<typeof getRepairDeviceTimeline>>
  >([]);
  const [, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open || !repair) {
      setTimeline([]);
      return;
    }
    startTransition(async () => {
      const rows = await getRepairDeviceTimeline(
        repair.edit.serialNumber,
        repair.edit.brand,
        repair.edit.model
      );
      setTimeline(rows);
    });
  }, [open, repair]);

  if (!repair) return null;

  const statusColor =
    repair.status === "COMPLETED"
      ? "green"
      : repair.status === "IN_PROGRESS"
        ? "amber"
        : "slate";

  return (
    <Modal open={open} onClose={onClose} title={repair.title} className="max-w-3xl">
      <div className="max-h-[min(80vh,720px)] space-y-5 overflow-y-auto pr-1">
        <div>
          <p className="text-sm text-slate-600">{repair.subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge color="slate">{sourceLabel(repair.source)}</Badge>
            {repair.isChargeWaived && <Badge color="green">No charge</Badge>}
            <Badge color={statusColor}>{repair.status.replace("_", " ")}</Badge>
          </div>
        </div>

        {!repair.isChargeWaived && repair.paymentSummary.total > 0 && (
          <PaymentStatus summary={repair.paymentSummary} />
        )}

        <div className="rounded-xl border border-slate-200 p-4">
          <p className="mb-3 text-sm font-semibold text-slate-900">Edit job</p>
          <EditRepairJobForm
            repair={repair.edit}
            options={options}
            onSaved={() => router.refresh()}
            embedded
          />
        </div>

        {!repair.isChargeWaived && repair.paymentSummary.total > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-sm font-medium text-slate-800">Record payment</p>
            <p className="mt-1 text-xs text-slate-500">
              Single job only — use <strong>Add payment</strong> on the list for multiple jobs.
            </p>
            <div className="mt-3">
              <PaymentForm target={{ type: "repair", id: repair.id }} />
            </div>
          </div>
        )}

        {timeline.length > 0 && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-900">Device repair history</p>
            <RepairDeviceHistory repairs={timeline} currentId={repair.id} />
          </div>
        )}

        {!repair.isChargeWaived && repair.payments.length > 0 && (
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="mb-2 text-sm font-semibold text-slate-900">Payments</p>
            <ul className="divide-y text-sm">
              {repair.payments.map((p) => (
                <li key={p.id} className="flex justify-between py-2">
                  <span className="text-slate-600">
                    {formatDate(p.paidAt)}
                    {p.reference && ` · OR# ${p.reference}`}
                  </span>
                  <span className="font-semibold text-emerald-700">
                    {formatCurrency(p.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          <Link
            href={`/dashboard/repairs/${repair.id}`}
            className="text-brand-600 hover:underline"
          >
            Open full page
          </Link>
        </p>
      </div>
    </Modal>
  );
}
