"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  Car,
  LayoutDashboard,
  LogOut,
  Route,
  Users,
  Wallet,
} from "lucide-react";
import { cn } from "@trylo/ui";
import { useAdminLogout, useCurrentAdmin } from "@trylo/mock-data/hooks";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/drivers", label: "Drivers", icon: Car },
  { href: "/rides", label: "Rides", icon: Route },
  { href: "/payments", label: "Payments", icon: Wallet },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: admin } = useCurrentAdmin();

  return (
    <aside className="flex h-dvh w-64 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 px-6 py-5">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow-sm">
          <LayoutDashboard size={18} />
        </span>
        <div>
          <p className="font-display text-base font-semibold text-foreground">TRYLO</p>
          <p className="text-xs text-muted-foreground">Admin</p>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium"
            >
              {active && (
                <motion.span
                  layoutId="admin-nav-active"
                  className="absolute inset-0 rounded-xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}
              <Icon size={18} className={cn("relative", active ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("relative", active ? "text-primary" : "text-foreground")}>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-3 py-4">
        {admin && <p className="truncate px-3 pb-2 text-xs text-muted-foreground">{admin.email}</p>}
        <LogoutButton onLoggedOut={() => router.replace("/login")} />
      </div>
    </aside>
  );
}

function LogoutButton({ onLoggedOut }: { onLoggedOut: () => void }) {
  const logout = useAdminLogout();

  async function handleLogout() {
    await logout.mutateAsync();
    onLoggedOut();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={logout.isPending}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <LogOut size={18} />
      Log out
    </button>
  );
}
