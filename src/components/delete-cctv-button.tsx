"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteCctv } from "@/actions/cctv";
import { Button } from "@/components/ui/button";

export function DeleteCctvButton({
  id,
  clientName,
}: {
  id: string;
  clientName: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      loading={pending}
      onClick={() => {
        const confirmed = window.confirm(
          `Delete the CCTV installation for "${clientName}"?\n\nThis action cannot be undone.`
        );

        if (!confirmed) return;

        startTransition(async () => {
          await deleteCctv(id);
        });
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
}