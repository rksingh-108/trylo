"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, LayoutDashboard, User, Wallet } from "lucide-react";
import { cn } from "@trylo/ui";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/earnings", label: "Earnings", icon: Wallet },
  { href: "/history", label: "History", icon: Clock },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  if (!ITEMS.some((item) => item.href === pathname)) return null;

  return (
    <nav className="z-40 shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
      <div className="glass-strong flex items-center justify-around rounded-[1.75rem] px-2 py-2 shadow-elevation-3">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-2xl px-3 py-2"
            >
              {active && (
                <motion.span
                  layoutId="driver-nav-active"
                  className="absolute inset-0 rounded-2xl bg-primary/10"
                  transition={{ type: "spring", stiffness: 500, damping: 34 }}
                />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 2}
                className={cn("relative transition-colors", active ? "text-primary" : "text-muted-foreground")}
              />
              <span
                className={cn(
                  "relative text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
