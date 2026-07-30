import { listVisitStaffUsers } from "@/actions/visit-staff";
import { ManageVisitStaffPanel } from "@/components/forms/manage-visit-staff-panel";

export async function ManageVisitStaff() {
  const staff = await listVisitStaffUsers();
  return <ManageVisitStaffPanel staff={staff} />;
}
