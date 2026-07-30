import { VisitsPageContent } from "@/components/visits-page-content";

export default function DashboardVisitsPage() {
  return (
    <div className="space-y-6">
      <VisitsPageContent showStaffAdmin embedInDashboard />
    </div>
  );
}
