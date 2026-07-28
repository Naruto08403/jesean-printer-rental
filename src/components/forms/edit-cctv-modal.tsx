"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { updateCctvStatus } from "@/actions/cctv";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { ServiceStatus } from "@prisma/client";

type EditCctvModalProps = {
  job: {
    id: string;
    clientId: string;
    status: ServiceStatus;
    totalAmount: number;
    siteAddress: string;
    description: string;
    dateStarted: string | null;
    dateCompleted: string | null;
  };
  clients: {
    id: string;
    name: string;
  }[];
};

export function EditCctvModal({
  job,
  clients,
}: EditCctvModalProps) {

  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const [clientId, setClientId] = useState(job.clientId);
  const [status] = useState<ServiceStatus>(job.status);
  const [totalAmount, setTotalAmount] = useState(job.totalAmount);
  const [siteAddress, setSiteAddress] = useState(job.siteAddress);
  const [description, setDescription] = useState(job.description);
  const [dateStarted, setDateStarted] = useState(job.dateStarted ?? "");
  const [dateCompleted, setDateCompleted] = useState(job.dateCompleted ?? "");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    startTransition(async () => {
      await updateCctvStatus(
        job.id,
        clientId,
        status,
        totalAmount,
        dateStarted ? new Date(dateStarted) : null,
        dateCompleted ? new Date(dateCompleted) : null,
        siteAddress,
        description
      );

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Edit installation
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Edit CCTV installation"
        className="max-w-xl"
      >
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={handleSubmit}
        >
          <div className="sm:col-span-2">
            <Label>Client</Label>
            <Select
                name="clientId"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
              >
              {(clients ?? []).map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label>Total amount</Label>
            <Input
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
            />
          </div>

          <div>
            <Label>Date started</Label>
            <Input
              type="date"
              value={dateStarted}
              onChange={(e) => setDateStarted(e.target.value)}
            />
          </div>

          <div>
            <Label>Site address</Label>
            <Input
              value={siteAddress}
              onChange={(e) => setSiteAddress(e.target.value)}
            />
          </div>

          <div>
            <Label>Date completed</Label>
            <Input
              type="date"
              value={dateCompleted}
              onChange={(e) => setDateCompleted(e.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>

            <Button type="submit" loading={pending}>
              {pending ? "Updating..." : "Update job"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}