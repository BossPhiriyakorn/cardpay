"use client";

import { usePathname } from "next/navigation";
import DynamicIslandNav from "@/components/DynamicIslandNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCmsRoute = pathname.startsWith("/cms");
  const isShareRoute = pathname.startsWith("/share");
  const isRegisterRoute = pathname.startsWith("/register");

  if (isCmsRoute || isShareRoute || isRegisterRoute) {
    return <main className="min-h-screen flex flex-col">{children}</main>;
  }

  return (
    <>
      <DynamicIslandNav />
      <main className="min-h-screen pt-24 md:pt-28 flex flex-col">{children}</main>
    </>
  );
}
