"use client";

import { deleteSale } from "@/actions/sales";

export function DeleteSaleButton({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  async function handleDelete() {
    if (!confirm("Delete this sale?")) return;

    await deleteSale(id);
  }

  return <div onClick={handleDelete}>{children}</div>;
}