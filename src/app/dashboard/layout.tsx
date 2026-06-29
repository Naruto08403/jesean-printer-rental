import { DashboardShell } from "@/components/dashboard-nav";
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <DashboardShell userEmail={session?.user?.email}>
      {children}
    </DashboardShell>
  );
}
