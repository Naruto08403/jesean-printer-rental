"use client";

import { useState } from "react";
import type { PrinterStatus, PrinterType } from "@prisma/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SubmitButton, FormLoadingOverlay } from "@/components/submit-button";

export function EditPrinterForm({
  printer,
  clients,
  action,
}: {
  printer: {
    serialNumber: string | null;
    brand: string | null;
    model: string | null;
    price: number | null;
    status: PrinterStatus;
    type: PrinterType;
    ownerClientId: string | null;
  };
  clients: { id: string; name: string }[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [type, setType] = useState<PrinterType>(printer.type);

  return (
    <form action={action} className="mt-4 space-y-3">
      <div>
        <Label>Type *</Label>
        <Select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as PrinterType)}
          className="mt-1"
          required
        >
          <option value="RENTAL">Rental (admin fleet)</option>
          <option value="WALK_IN">Walk-in (client personal)</option>
        </Select>
      </div>

      <div>
        <Label>Owner *</Label>
        {type === "RENTAL" ? (
          <Input value="Admin" disabled className="mt-1 bg-slate-50" />
        ) : (
          <Select
            name="ownerClientId"
            defaultValue={printer.ownerClientId ?? ""}
            className="mt-1"
            required
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div>
        <Label>Serial</Label>
        <Input name="serialNumber" defaultValue={printer.serialNumber ?? ""} />
      </div>
      <div>
        <Label>Brand</Label>
        <Input name="brand" defaultValue={printer.brand ?? ""} />
      </div>
      <div>
        <Label>Model</Label>
        <Input name="model" defaultValue={printer.model ?? ""} />
      </div>
      <div>
        <Label>Price (PHP)</Label>
        <Input
          name="price"
          type="number"
          step="0.01"
          min="0"
          defaultValue={printer.price ?? ""}
        />
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={printer.status}>
          <option value="AVAILABLE">Available</option>
          <option value="RENTED">Rented</option>
          <option value="IN_REPAIR">In repair</option>
          <option value="RETIRED">Retired</option>
        </Select>
      </div>
      <SubmitButton loadingText="Saving…">Save</SubmitButton>
      <FormLoadingOverlay message="Saving printer…" />
    </form>
  );
}
