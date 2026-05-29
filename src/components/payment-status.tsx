import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { PaymentSummary } from "@/lib/payments";

export function PaymentStatus({ summary }: { summary: PaymentSummary }) {
  const color = summary.isFullyPaid ? "green" : summary.paid > 0 ? "amber" : "red";
  const label = summary.isFullyPaid
    ? "Paid"
    : summary.paid > 0
      ? "Partial"
      : "Unpaid";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <Badge color={color}>{label}</Badge>
      <span className="text-slate-500">
        {formatCurrency(summary.paid)} / {formatCurrency(summary.total)}
      </span>
      {!summary.isFullyPaid && (
        <span className="font-medium text-slate-700">
          Balance: {formatCurrency(summary.balance)}
        </span>
      )}
    </div>
  );
}
