"use client";

import { usePathname } from "next/navigation";
import { AppHeader } from "./app-header";
import { useAuth } from "@/lib/auth-client";

export function HeaderWrapper() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isLoginPage = pathname === "/api/auth/signin";
  // Hide header entirely if user not authenticated (login screen should be standalone)
  if (!user) return null;
  if (isLoginPage) return null;
  return <AppHeader />;
}
