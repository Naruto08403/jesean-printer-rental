/** Group key for repair payments — matches AddRepairPaymentModal client groups. */
export function repairClientKey(clientId: string | null, clientLabel: string): string {
  return clientId ?? `walkin:${clientLabel}`;
}
