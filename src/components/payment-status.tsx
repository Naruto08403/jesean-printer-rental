import { Badge } from "@/components/ui/badge";
import { formatCurrency, cn, formatDate } from "@/lib/utils";
import type { PaymentSummary } from "@/lib/payments";

export function PaymentStatus({
  summary,
  billing,
  onPayClick,
}: {
  summary: PaymentSummary;
  billing?: string | Date | null;
  onPayClick?: () => void;
}) {
  const isUntouched = summary.total === 0;

const color = isUntouched
  ? "blue"
  : summary.isFullyPaid
    ? "green"
    : summary.paid > 0
      ? "amber"
      : "red";

const label = isUntouched
  ? "Untouched"
  : summary.isFullyPaid
    ? "Paid"
    : summary.paid > 0
      ? "Partial"
      : "Unpaid";

const canPay =
  !isUntouched &&
  !summary.isFullyPaid &&
  onPayClick;
  // const color = summary.isFullyPaid ? "green" : summary.paid > 0 ? "amber" : "red";

  // const label = summary.isFullyPaid
  //   ? "Paid"
  //   : summary.paid > 0
  //     ? "Partial"
  //     : "Unpaid";

  // const canPay = !summary.isFullyPaid && onPayClick;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {canPay ? (
        <button
          type="button"
          onClick={onPayClick}
          // className={cn(
          //   "inline-flex cursor-pointer items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition hover:opacity-90",
          //   color === "red" && "bg-red-50 text-red-700 ring-red-600/20",
          //   color === "amber" && "bg-amber-50 text-amber-800 ring-amber-600/20"
          // )}
          className={cn(
            "inline-flex cursor-pointer items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset transition hover:opacity-90",
            color === "blue" && "bg-sky-50 text-sky-700 ring-sky-600/20",
            color === "red" && "bg-red-50 text-red-700 ring-red-600/20",
            color === "amber" && "bg-amber-50 text-amber-800 ring-amber-600/20"
          )}
        >
          {label}
        </button>
      ) : (
        <Badge color={color}>{label}</Badge>
      )}

      <span className="text-slate-500">
        {formatCurrency(summary.paid)} / {formatCurrency(summary.total)}
      </span>

      {billing && (
        <span className="font-medium text-slate-700">
          Billing: {formatDate(billing)}
        </span>
      )}
    </div>
  );
}