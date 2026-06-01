import { Badge } from "@/components/ui/badge";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import { printerLabel } from "@/lib/portal-data";
import type { ServiceStatus } from "@prisma/client";

const statusColor: Record<ServiceStatus, "green" | "amber" | "slate" | "red" | "blue"> = {
  PENDING: "amber",
  IN_PROGRESS: "blue",
  COMPLETED: "green",
  CANCELLED: "red",
};

export function PortalServiceCard({
  kind,
  title,
  subtitle,
  status,
  totalAmount,
  payments,
  date,
  printer,
}: {
  kind: "repair" | "purchase" | "cctv";
  title: string;
  subtitle?: string;
  status: ServiceStatus;
  totalAmount: number;
  payments: { amount: number }[];
  date: Date;
  printer?: { brand: string | null; model: string | null } | null;
}) {
  const summary = summarizePayments(totalAmount, payments);
  const kindLabel =
    kind === "repair" ? "Repair" : kind === "purchase" ? "Purchase" : "CCTV";

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Badge color="blue">{kindLabel}</Badge>
            <Badge color={statusColor[status] ?? "slate"}>
              {status.replace("_", " ")}
            </Badge>
          </div>
          <p className="mt-2 font-semibold text-slate-900">{title}</p>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          {printer && (
            <p className="mt-1 text-xs text-slate-500">
              Printer: {printerLabel(printer, "—")}
            </p>
          )}
        </div>
        <p className="text-lg font-bold text-slate-900">{formatCurrency(totalAmount)}</p>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-slate-500">{formatDate(date)}</span>
        <PaymentStatus summary={summary} />
      </div>
    </div>
  );
}
