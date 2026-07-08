import { cn } from "@/lib/utils";

export function Spinner({
  className,
  size = "md",
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "h-4 w-4 border-2",
    md: "h-5 w-5 border-2",
    lg: "h-8 w-8 border-[3px]",
  };

  return (
    <span
      className={cn(
        "inline-block animate-spin rounded-full border-current border-r-transparent",
        sizes[size],
        className
      )}
      aria-hidden
    />
  );
}
