import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { listRepairDiagnosisOptions } from "@/actions/repair-diagnoses";
import { ManageDiagnosisOptions } from "@/components/forms/manage-diagnosis-options";

export default async function RepairDiagnosesPage() {
  const items = await listRepairDiagnosisOptions(true);

  return (
    <div className="space-y-6">
      <Link href="/dashboard/repairs" className="text-sm text-brand-600 hover:underline">
        ← Repairs
      </Link>
      <PageHeader
        title="Diagnosis prices"
        subtitle="Manage repair diagnosis options and prices. Repair totals are calculated from selected items."
      />
      <p className="text-sm text-slate-600">
        When accepting or editing a repair, select one or more diagnoses. The repair price is the
        sum of their catalog prices (unless the charge is waived).
      </p>
      <ManageDiagnosisOptions
        items={items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
        }))}
      />
    </div>
  );
}
