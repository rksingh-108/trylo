"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Loader2, Phone, ShieldCheck } from "lucide-react";
import { Button, Input, Label, PageTransition } from "@trylo/ui";
import { useRequestOtp } from "@trylo/mock-data/hooks";
import { phoneSchema, type PhoneInput } from "@/lib/validation";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0, 0, 0.2, 1] } },
};

export default function AuthPage() {
  const router = useRouter();
  const requestOtp = useRequestOtp();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<PhoneInput>({ resolver: zodResolver(phoneSchema) });

  async function onSubmit(values: PhoneInput) {
    await requestOtp.mutateAsync(values.phone);
    router.push(`/auth/otp?phone=${values.phone}`);
  }

  return (
    <PageTransition className="relative flex flex-1 flex-col">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-[90px]" />
        <div className="absolute -right-20 top-1/3 h-64 w-64 rounded-full bg-teal-500/10 blur-[100px]" />
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative flex flex-1 flex-col justify-between px-6 pb-8 pt-16"
      >
        <div>
          <motion.div variants={item} className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-amber-600 shadow-glow-sm">
              <Phone className="h-5 w-5 text-primary-foreground" />
            </span>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">TRYLO</p>
          </motion.div>

          <motion.h1
            variants={item}
            className="mt-7 font-display text-4xl font-semibold leading-[1.1] tracking-tight text-foreground"
          >
            Ride in minutes,
            <br />
            <span className="bg-gradient-to-r from-primary via-amber-500 to-amber-600 bg-clip-text text-transparent">
              anywhere in the city.
            </span>
          </motion.h1>
          <motion.p variants={item} className="mt-3 text-sm text-muted-foreground">
            Bikes, autos and cabs — on demand, at your doorstep.
          </motion.p>
        </div>

        <motion.form variants={item} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="phone">Mobile number</Label>
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-card pl-4 shadow-elevation-1 transition-all focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15">
              <span className="font-mono text-base font-medium text-muted-foreground">+91</span>
              <div className="h-6 w-px bg-border" />
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="98765 43210"
                className="h-14 border-0 bg-transparent pl-2 shadow-none focus-visible:ring-0"
                {...register("phone")}
              />
            </div>
            {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            {requestOtp.isError && <p className="text-sm text-destructive">Something went wrong. Try again.</p>}
          </div>

          <Button type="submit" size="lg" variant="glow" className="w-full" disabled={requestOtp.isPending}>
            {requestOtp.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {requestOtp.isPending ? "Sending code..." : "Continue"}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            By continuing, you agree to TRYLO's Terms of Service and Privacy Policy.
          </p>
        </motion.form>
      </motion.div>
    </PageTransition>
  );
}
