import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { updateCctvStatus } from "@/actions/cctv";
import { PaymentForm } from "@/components/payment-form";
import { PaymentStatus } from "@/components/payment-status";
import { summarizePayments } from "@/lib/payments";
import { formatCurrency, formatDate } from "@/lib/utils";
import Link from "next/link";
import { SubmitButton, FormLoadingOverlay } from "@/components/submit-button";
import { Select } from "@/components/ui/select";
import type { ServiceStatus } from "@prisma/client";

export default async function CctvDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = await prisma.cctvInstallation.findUnique({
    where: { id },
    include: {  payments: { orderBy: { paidAt: "desc" } } },
  });
  if (!job) notFound();

  const summary = summarizePayments(job.totalAmount, job.payments);

  async function setStatus(formData: FormData) {
    "use server";
  
    await updateCctvStatus(
      id,
      formData.get("status") as ServiceStatus,
      Number(formData.get("totalAmount")),
      new Date(String(formData.get("dateStarted"))),
      formData.get("completedAt")
        ? new Date(String(formData.get("completedAt")))
        : null,
      String(formData.get("siteAddress") ?? ""),
      String(formData.get("description") ?? "")
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/dashboard/cctv" className="text-sm text-brand-600 hover:underline">
        ← CCTV
      </Link>
      <h1 className="text-2xl font-bold">{job.clientName}</h1>
      <p className="text-slate-500">{job.siteAddress ?? job.description ?? "Installation"}</p>
      <PaymentStatus summary={summary} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Record payment</CardTitle>
          <div className="mt-4">
            <PaymentForm target={{ type: "cctv", id }} />
          </div>
        </Card>
        <Card>
          <CardTitle>Status</CardTitle>
          <form action={setStatus} className="mt-4 flex gap-2">
            <Select name="status" defaultValue={job.status}>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </Select>
            <SubmitButton variant="secondary" loadingText="Updating…">
              Update
            </SubmitButton>
            <FormLoadingOverlay message="Updating job status…" />
          </form>
        </Card>
      </div>

      <Card>
        <CardTitle>Payments</CardTitle>
        <ul className="mt-4 divide-y text-sm">
        <li className="flex justify-between py-3">
              <span>Date</span>
              <span>Payment Reference Number</span>
              <span>Amount</span>
            </li>
          {job.payments.map((p) => (
            <li key={p.id} className="flex justify-between py-3">
              <span>{formatDate(p.paidAt)}</span>
              <span>{p.reference}</span>
              <span>{formatCurrency(p.amount)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
