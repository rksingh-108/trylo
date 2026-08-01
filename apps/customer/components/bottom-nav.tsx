"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Home, User, Wallet } from "lucide-react";
import { cn } from "@trylo/ui";

const ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/history", label: "Activity", icon: Clock },
  { href: "/wallet", label: "Wallet", icon: Wallet },
  { href: "/profile", label: "Profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();
  if (!ITEMS.some((item) => item.href === pathname)) return null;

  return (
    <nav className="flex items-center justify-around border-t border-border bg-card px-2 py-2">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className="flex flex-col items-center gap-1 px-3 py-1.5">
            <Icon size={20} className={active ? "text-primary" : "text-muted-foreground"} />
            <span className={cn("text-xs font-medium", active ? "text-primary" : "text-muted-foreground")}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
