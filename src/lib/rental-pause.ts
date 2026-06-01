import { MONTH_LABELS } from "@/lib/rental-annual";

export function pausePeriodDatesFromMonths(
  year: number,
  startMonth: number,
  endMonth: number
): { pausedAt: Date; resumedAt: Date | null } {
  const pausedAt = new Date(year, startMonth, 1, 0, 0, 0, 0);
  const resumedAt = new Date(year, endMonth + 1, 0, 23, 59, 59, 999);
  return { pausedAt, resumedAt };
}

export function formatPausePeriodRange(pausedAt: Date, resumedAt: Date | null): string {
  const startYear = pausedAt.getFullYear();
  const startMonth = pausedAt.getMonth();
  if (!resumedAt) {
    return `${MONTH_LABELS[startMonth]} ${startYear} – ongoing`;
  }
  const endYear = resumedAt.getFullYear();
  const endMonth = resumedAt.getMonth();
  if (startYear === endYear && startMonth === endMonth) {
    return `${MONTH_LABELS[startMonth]} ${startYear}`;
  }
  if (startYear === endYear) {
    return `${MONTH_LABELS[startMonth]}–${MONTH_LABELS[endMonth]} ${startYear}`;
  }
  return `${MONTH_LABELS[startMonth]} ${startYear} – ${MONTH_LABELS[endMonth]} ${endYear}`;
}

export function pausePeriodKey(pausedAt: Date, resumedAt: Date | null): string {
  return `${pausedAt.toISOString()}|${resumedAt?.toISOString() ?? ""}`;
}
