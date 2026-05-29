export type PaymentSummary = {
  total: number;
  paid: number;
  balance: number;
  isFullyPaid: boolean;
};

export function summarizePayments(
  total: number,
  payments: { amount: number }[]
): PaymentSummary {
  const paid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, total - paid);
  return {
    total,
    paid,
    balance,
    isFullyPaid: balance <= 0.001,
  };
}

export function rentalExpectedTotal(rental: {
  ratePerPeriod: number;
  totalContract: number | null;
  startDate: Date;
  endDate: Date | null;
}): number {
  if (rental.totalContract != null) return rental.totalContract;
  if (!rental.endDate) return rental.ratePerPeriod;
  const months = Math.max(
    1,
    Math.ceil(
      (rental.endDate.getTime() - rental.startDate.getTime()) /
        (1000 * 60 * 60 * 24 * 30)
    )
  );
  return rental.ratePerPeriod * months;
}
