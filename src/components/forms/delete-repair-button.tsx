"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteRepair } from "@/actions/repairs";
import { Button } from "@/components/ui/button";

export function DeleteRepairButton({
  repairId,
  label = "Delete repair",
  redirectTo = "/dashboard/repairs",
  paymentCount = 0,
  onDeleted,
  variant = "danger",
  className,
}: {
  repairId: string;
  label?: string;
  redirectTo?: string;
  paymentCount?: number;
  onDeleted?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    const paymentNote =
      paymentCount > 0
        ? `\n\nThis will also delete ${paymentCount} linked payment record${paymentCount === 1 ? "" : "s"}.`
        : "";
    if (
      !confirm(
        `Delete this repair record? This cannot be undone.${paymentNote}`
      )
    ) {
      return;
    }

    startTransition(async () => {
      await deleteRepair(repairId);
      onDeleted?.();
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      loading={pending}
      onClick={handleDelete}
      className={className}
    >
      <Trash2 className="h-4 w-4" />
      {pending ? "Deleting…" : label}
    </Button>
  );
}
