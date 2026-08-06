"use client";

import * as React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme, type Theme } from "./theme-provider";
import { cn } from "../lib/cn";

const OPTIONS: { value: Theme; label: string; icon: React.ElementType }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={cn("relative inline-flex items-center gap-1 rounded-full bg-muted p-1", className)}>
      {OPTIONS.map((opt) => {
        const active = theme === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => setTheme(opt.value)}
            className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          >
            {active && (
              <motion.span
                layoutId="theme-toggle-active"
                className="absolute inset-0 rounded-full bg-card shadow-elevation-1"
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
            )}
            <Icon
              size={15}
              className={cn("relative", active ? "text-foreground" : "text-muted-foreground")}
            />
            <span className="sr-only">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
