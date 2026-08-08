"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Loader2 } from "lucide-react";
import { Button, Input, Label, toast } from "@trylo/ui";
import { useAdminLogin } from "@trylo/mock-data/hooks";

export default function AdminLoginPage() {
  const router = useRouter();
  const login = useAdminLogin();

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login.mutateAsync({ email, password });
      router.replace("/dashboard");
    } catch {
      toast.error("Invalid email or password");
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-elevation-3"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-glow-sm">
            <LayoutDashboard size={22} />
          </span>
          <div>
            <h1 className="font-display text-xl font-semibold text-foreground">TRYLO Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to manage the platform.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@trylo.dev"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <Button type="submit" size="lg" variant="glow" disabled={login.isPending} className="mt-2">
            {login.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {login.isPending ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
