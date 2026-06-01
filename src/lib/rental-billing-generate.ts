import type { GenerateBillingInput } from "@/lib/rental-billing-shared";
import { generateClientBillingExcel } from "@/lib/rental-billing-excel";

export async function generateClientBilling(input: GenerateBillingInput): Promise<Buffer> {
  return generateClientBillingExcel(input);
}

export function billingContentType(): string {
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
