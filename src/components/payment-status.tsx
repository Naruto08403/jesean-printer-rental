import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn } from "@/lib/utils";
import type { PaymentSummary } from "@/lib/payments";

export function PaymentStatus({
  summary,
  onPayClick,
}: {
  summary: PaymentSummary;
  /** When set, unpaid/partial badge is clickable (e.g. open add payment). */
  onPayClick?: () => void;
}) {
  const color = summary.isFullyPaid ? "green" : summary.paid > 0 ? "amber" : "red";
  const label = summary.isFullyPaid
    ? "Paid"
    : summary.paid > 0
      ? "Partial"
      : "Unpaid";

  const canPay = !summary.isFullyPaid && onPayClick;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {canPay ? (
        <button
          type="button"
          onClick={onPayClick}
          className={cn(
            "inline-flex cursor-pointer items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition hover:opacity-90 focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-brand-500",
            color === "red" && "bg-red-50 text-red-700 ring-red-600/20",
            color === "amber" && "bg-amber-50 text-amber-800 ring-amber-600/20"
          )}
          title="Add payment for this client"
        >
          {label}
        </button>
      ) : (
        <Badge color={color}>{label}</Badge>
      )}
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
