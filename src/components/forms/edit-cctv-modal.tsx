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
import { prisma } from "@/lib/prisma";
import type { ServiceStatus } from "@prisma/client";

type EditCctvModalProps = {
  job: {
    id: string;
    status: ServiceStatus;
    totalAmount: number;
    siteAddress: string;
    description: string;
    dateStarted: string;
    dateCompleted: string;
  };
};

export function EditCctvModal({ job }: EditCctvModalProps) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const [status, setStatus] = useState<ServiceStatus>(job.status);
    const [totalAmount, setTotalAmount] = useState(job.totalAmount);
    // const [dateStarted, setDateStarted] = useState(job.dateStarted);
    // const [dateCompleted, setDateCompleted] = useState<Date | null>(
    // job.dateCompleted
    // );
    const [dateStarted, setDateStarted] = useState<Date>(
      new Date(job.dateStarted)
    );
    
    const [dateCompleted, setDateCompleted] = useState<Date | null>(
      job.dateCompleted ? new Date(job.dateCompleted) : null
    );
    const [siteAddress, setSiteAddress] = useState(job.siteAddress);
    const [description, setDescription] = useState(job.description);
    

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Edit installation
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit CCTV installation" className="max-w-xl">
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            startTransition(async () => {
                await updateCctvStatus(
                    job.id,
                    status,
                    totalAmount,
                    dateStarted,
                    dateCompleted,
                    siteAddress,
                    description
                  );
              setOpen(false);
              router.refresh();
            })
          }
        >
          {/* <div>
            <Label>Status</Label>
            <Select name="status" value={status} onChange={(e) => setStatus(e.target.value as ServiceStatus)}>
              <SelectTrigger>
            <SelectContent>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="IN_PROGRESS">In progress</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>
          </div> */}
          <div>
            <Label>Total amount</Label>
            <Input name="totalAmount" type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(Number(e.target.value))} />
          </div>
          <div>
            <Label>Date started</Label>
            <Input name="dateStarted" type="date" value={dateStarted.toISOString().split('T')[0]} 
            onChange={(e) =>
                setDateStarted(
                  e.target.value ? new Date(e.target.value) : new Date()
                )
              }
            />
          </div>
          <div>
            <Label>Site address</Label>
            <Input name="siteAddress" value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} />
          </div>
          <div>
            <Label>Date completed</Label>
            <Input
              name="dateCompleted"
              type="date"
              value={dateCompleted ? dateCompleted.toISOString().split('T')[0] : ""}
              onChange={(e) =>
                setDateCompleted(
                  e.target.value ? new Date(e.target.value) : null
                )
              }
              />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Input name="description" value={description ?? ""} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
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
