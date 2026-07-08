"use client";

import { SessionProvider } from "next-auth/react";
import { NavigationProgress } from "@/components/navigation-progress";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <NavigationProgress />
      {children}
    </SessionProvider>
  );
}
