import { MONTH_LABELS } from "@/lib/rental-annual";

export type RawRentalPayment = {
  id: string;
  amount: number;
  paidAt: Date;
  billingYear: number | null;
  billingMonth: number | null;
  batchId: string | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  createdAt: Date;
  rentalId: string | null;
};

export type RentalPaymentRecordGroup = {
  id: string;
  paymentIds: string[];
  date: string;
  reference: string | null;
  amount: number;
  amountPerEntry: number;
  monthRange: string;
  months: number[];
  year: number;
  notes: string | null;
  method: string | null;
  entryCount: number;
};

const CLUSTER_GAP_MS = 5_000;

function metadataKey(p: RawRentalPayment) {
  return `${p.reference ?? ""}\x00${p.notes ?? ""}\x00${p.method ?? ""}`;
}

function billingMonthOf(p: RawRentalPayment, year: number): number {
  if (p.billingYear === year && p.billingMonth != null) return p.billingMonth;
  return new Date(p.paidAt).getMonth();
}

/** Same bulk save (reference + notes + time bucket, or shared batchId). */
export function paymentsShareBulkCluster(a: RawRentalPayment, b: RawRentalPayment): boolean {
  if (a.batchId && b.batchId) return a.batchId === b.batchId;
  return (
    metadataKey(a) === metadataKey(b) &&
    Math.abs(a.createdAt.getTime() - b.createdAt.getTime()) <= CLUSTER_GAP_MS
  );
}

export function formatMonthRangeLabel(months: number[], year: number): string {
  if (months.length === 0) return "—";
  const sorted = [...months].sort((a, b) => a - b);
  if (sorted.length === 1) {
    return `${MONTH_LABELS[sorted[0]]} ${year}`;
  }
  let contiguous = true;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] !== sorted[i - 1] + 1) {
      contiguous = false;
      break;
    }
  }
  if (contiguous) {
    return `${MONTH_LABELS[sorted[0]]}–${MONTH_LABELS[sorted[sorted.length - 1]]} ${year}`;
  }
  return `${sorted.map((m) => MONTH_LABELS[m]).join(", ")} ${year}`;
}

/** Groups bulk rental payments saved together into one history row. */
export function groupRentalPaymentRecords(
  payments: RawRentalPayment[],
  year: number
): RentalPaymentRecordGroup[] {
  const sorted = [...payments].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  const clusters: RawRentalPayment[][] = [];
  for (const payment of sorted) {
    const lastCluster = clusters[clusters.length - 1];
    const lastInCluster = lastCluster?.[lastCluster.length - 1];

    if (lastCluster && lastInCluster && paymentsShareBulkCluster(payment, lastInCluster)) {
      lastCluster.push(payment);
    } else {
      clusters.push([payment]);
    }
  }

  return clusters
    .map((cluster) => {
      const first = cluster[0];
      const paymentIds = cluster.map((p) => p.id);
      const months = [
        ...new Set(cluster.map((p) => billingMonthOf(p, year))),
      ].sort((a, b) => a - b);

      return {
        id: first.id,
        paymentIds,
        date: first.createdAt.toISOString(),
        reference: first.reference,
        amount: cluster.reduce((sum, p) => sum + p.amount, 0),
        amountPerEntry: first.amount,
        monthRange: formatMonthRangeLabel(months, year),
        months,
        year,
        notes: first.notes,
        method: first.method,
        entryCount: cluster.length,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
