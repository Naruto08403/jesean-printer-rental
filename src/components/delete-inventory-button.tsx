"use client";

import { deleteInventory } from "@/actions/inventory";

export function DeleteInventoryButton({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  async function handleDelete() {
    if (!confirm("Delete this sale?")) return;

    await deleteInventory(id);
  }

  return <div onClick={handleDelete}>{children}</div>;
}