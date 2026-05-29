import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DataTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  );
}

export function DataTableElement({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <table className={cn("w-full min-w-[640px] text-left text-sm", className)}>
      {children}
    </table>
  );
}
