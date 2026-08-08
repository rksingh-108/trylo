"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCurrentAdmin } from "@trylo/mock-data/hooks";
import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: admin, isFetched } = useCurrentAdmin();

  React.useEffect(() => {
    if (isFetched && !admin) router.replace("/login");
  }, [isFetched, admin, router]);

  if (!admin) return null;

  return (
    <div className="flex min-h-dvh w-full bg-background">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
