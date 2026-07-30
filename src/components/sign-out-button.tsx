"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function SignOutButton({ callbackUrl = "/login" }: { callbackUrl?: string }) {
  return (
    <Button
      variant="ghost"
      className="text-slate-600"
      onClick={() => signOut({ callbackUrl })}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
