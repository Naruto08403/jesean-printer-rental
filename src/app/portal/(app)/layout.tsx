import { auth } from "@/lib/auth";
import { getPortalClientData } from "@/lib/portal-data";
import { redirect } from "next/navigation";
import { PortalShell } from "@/components/portal/portal-shell";

export default async function PortalAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const clientId = session?.user?.clientId;
  if (!clientId) redirect("/portal/login");

  const data = await getPortalClientData(clientId);
  if (!data) redirect("/portal/login");

  const userName = session?.user?.name ?? session?.user?.username ?? data.client.name;

  return (
    <PortalShell userName={userName} notifications={data.notifications}>
      {children}
    </PortalShell>
  );
}
