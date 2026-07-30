export const VISIT_OVERDUE_DAYS = 6;

export function isVisitOverdue(daysAfter: number | null): boolean {
  if (daysAfter == null) return true;
  return daysAfter > VISIT_OVERDUE_DAYS;
}

export function daysAfterClass(days: number | null) {
  if (isVisitOverdue(days)) return "font-semibold text-red-700";
  return "text-slate-700";
}

export function visitRowClass(daysAfter: number | null) {
  if (isVisitOverdue(daysAfter)) {
    return "border-red-200 bg-red-50/90 hover:bg-red-50";
  }
  return "border-slate-100 bg-white hover:bg-slate-50/80";
}

export const VISIT_REASONS = [
  "Ink refill",
  "Toner refill",
  "Maintenance",
  "Paper supply",
  "Pickup / delivery",
  "Other",
] as const;

export type VisitReason = (typeof VISIT_REASONS)[number];

export function daysSinceVisit(date: Date | string | null | undefined): number | null {
  if (!date) return null;

  const visited = new Date(date);
  if (Number.isNaN(visited.getTime())) return null;

  const start = new Date(visited);
  start.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return Math.floor((today.getTime() - start.getTime()) / 86_400_000);
}

export function formatDaysAfter(days: number | null) {
  if (days == null) return "—";
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}
